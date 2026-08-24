#!/bin/sh
set -eu

base_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
compose="docker compose -f $base_dir/e2e-compose.yml -p switchbook-hydra-e2e"
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/switchbook-hydra-e2e.XXXXXX")
random_secret() { openssl rand -hex 32; }
export HYDRA_E2E_DB_PASSWORD="${HYDRA_E2E_DB_PASSWORD:-$(random_secret)}"
export HYDRA_E2E_SYSTEM_SECRET="${HYDRA_E2E_SYSTEM_SECRET:-$(random_secret)}"
client_secret="${HYDRA_E2E_CLIENT_SECRET:-$(random_secret)}"
down_services() { $compose down -v --remove-orphans >/dev/null 2>&1 || true; }
cleanup() { down_services; rm -rf "$tmp_dir"; }
trap cleanup EXIT INT TERM
down_services
$compose up -d --wait

json_value() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
query_value() { python3 -c "import sys,urllib.parse; print(urllib.parse.parse_qs(urllib.parse.urlparse(sys.stdin.read().strip()).query)['$1'][0])"; }
location() { awk 'tolower($0) ~ /^location:/{sub(/^[^:]*:[[:space:]]*/,""); sub(/\r$/,""); print; exit}'; }
challenge_for() { printf %s "$1" | openssl dgst -binary -sha256 | openssl base64 -A | tr '+/' '-_' | tr -d '='; }

client_id=keebvault_e2e
curl -fsS -X POST http://127.0.0.1:54445/admin/clients -H 'Content-Type: application/json' -d "{\"client_id\":\"$client_id\",\"client_secret\":\"$client_secret\",\"redirect_uris\":[\"http://127.0.0.1:59998/callback\"],\"grant_types\":[\"authorization_code\",\"refresh_token\"],\"response_types\":[\"code\"],\"scope\":\"openid offline_access catalog:read\",\"token_endpoint_auth_method\":\"client_secret_basic\"}" >/dev/null

authorize() {
  verifier=$1
  cookie_jar="$tmp_dir/cookies-$$"
  : >"$cookie_jar"
  challenge=$(challenge_for "$verifier")
  auth_url="http://127.0.0.1:54444/oauth2/auth?client_id=$client_id&response_type=code&scope=openid%20offline_access%20catalog%3Aread&redirect_uri=http%3A%2F%2F127.0.0.1%3A59998%2Fcallback&state=e2e-state&code_challenge=$challenge&code_challenge_method=S256"
  login_redirect=$(curl -sS -c "$cookie_jar" -b "$cookie_jar" -D - -o /dev/null "$auth_url" | location)
  login_challenge=$(printf %s "$login_redirect" | query_value login_challenge)
  continue_url=$(curl -fsS -X PUT "http://127.0.0.1:54445/admin/oauth2/auth/requests/login/accept?login_challenge=$login_challenge" -H 'Content-Type: application/json' -d '{"subject":"switchbook-e2e-user","remember":false}' | json_value "['redirect_to']")
  consent_redirect=$(curl -sS -c "$cookie_jar" -b "$cookie_jar" -D - -o /dev/null "$continue_url" | location)
  consent_challenge=$(printf %s "$consent_redirect" | query_value consent_challenge)
  continue_url=$(curl -fsS -X PUT "http://127.0.0.1:54445/admin/oauth2/auth/requests/consent/accept?consent_challenge=$consent_challenge" -H 'Content-Type: application/json' -d '{"grant_scope":["openid","offline_access","catalog:read"],"remember":false,"session":{"access_token":{"application_id":"e2e"},"id_token":{"username":"e2e"}}}' | json_value "['redirect_to']")
  callback=$(curl -sS -c "$cookie_jar" -b "$cookie_jar" -D - -o /dev/null "$continue_url" | location)
  rm -f "$cookie_jar"
  printf %s "$callback" | query_value code
}

token_status() {
  code=$1; verifier=${2-}
  args="grant_type=authorization_code&code=$code&redirect_uri=http%3A%2F%2F127.0.0.1%3A59998%2Fcallback"
  [ -z "$verifier" ] || args="$args&code_verifier=$verifier"
  curl -sS -o "$tmp_dir/token.json" -w '%{http_code}' -u "$client_id:$client_secret" -H 'Content-Type: application/x-www-form-urlencoded' -d "$args" http://127.0.0.1:54444/oauth2/token
}

verifier=$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=')
code=$(authorize "$verifier")
[ "$(token_status "$code")" = 400 ]
code=$(authorize "$verifier")
[ "$(token_status "$code" 'wrong-verifier-abcdefghijklmnopqrstuvwxyz-0123456789')" = 400 ]
code=$(authorize "$verifier")
[ "$(token_status "$code" "$verifier")" = 200 ]
access=$(json_value "['access_token']" <"$tmp_dir/token.json")
refresh=$(json_value "['refresh_token']" <"$tmp_dir/token.json")

active=$(curl -fsS -u "$client_id:$client_secret" -d "token=$access" http://127.0.0.1:54445/admin/oauth2/introspect | json_value "['active']")
[ "$active" = True ]
curl -fsS -u "$client_id:$client_secret" -H 'Content-Type: application/x-www-form-urlencoded' -d "grant_type=refresh_token&refresh_token=$refresh" http://127.0.0.1:54444/oauth2/token >"$tmp_dir/refresh.json"
reuse_status=$(curl -sS -o /dev/null -w '%{http_code}' -u "$client_id:$client_secret" -H 'Content-Type: application/x-www-form-urlencoded' -d "grant_type=refresh_token&refresh_token=$refresh" http://127.0.0.1:54444/oauth2/token)
[ "$reuse_status" = 400 ]
curl -fsS -u "$client_id:$client_secret" -d "token=$access" http://127.0.0.1:54444/oauth2/revoke >/dev/null
active=$(curl -fsS -u "$client_id:$client_secret" -d "token=$access" http://127.0.0.1:54445/admin/oauth2/introspect | json_value "['active']")
[ "$active" = False ]
echo 'Hydra E2E PASS: S256 required; wrong/missing verifier rejected; code/token/refresh rotation/reuse rejection/revocation verified.'
