import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productionComposeFiles = [
  "docker-compose.yml",
  "docker-backup/docker-compose-ghcr.yml",
  "docker-backup/docker-compose-original.yml",
];

const e2eComposeRequirements = new Map([
  ["ops/hydra/e2e-compose.yml", ["HYDRA_E2E_DB_PASSWORD", "HYDRA_E2E_SYSTEM_SECRET"]],
  ["ops/partner-api/e2e-compose.yml", ["PARTNER_E2E_DB_PASSWORD"]],
]);

test("production Compose files require an injected database password", () => {
  for (const file of productionComposeFiles) {
    const compose = readFileSync(file, "utf8");
    const passwordReferences = compose.match(/\$\{DB_PASSWORD[^}]*\}/g) ?? [];

    assert.ok(passwordReferences.length > 0, `${file} must reference DB_PASSWORD`);
    for (const reference of passwordReferences) {
      assert.equal(
        reference,
        "${DB_PASSWORD:?DB_PASSWORD is required}",
        `${file} must fail closed when DB_PASSWORD is absent`,
      );
    }
  }
});

test("E2E Compose credentials are injected and fail closed", () => {
  for (const [file, variables] of e2eComposeRequirements) {
    const compose = readFileSync(file, "utf8");
    for (const variable of variables) {
      assert.match(
        compose,
        new RegExp(`\\$\\{${variable}:\\?${variable} is required\\}`),
        `${file} must require ${variable}`,
      );
    }
  }
});

test("E2E fixtures do not commit recognizable credential literals", () => {
  const files = [
    "ops/hydra/e2e-compose.yml",
    "ops/hydra/e2e-oauth.sh",
    "ops/partner-api/e2e-compose.yml",
    "ops/partner-api/e2e-idempotency.sh",
  ];
  const forbidden = [
    /(?:hydra|partner)_e2e_password/i,
    /client_secret=(?!\"?\$\{?HYDRA_E2E_CLIENT_SECRET)/i,
    /isolated-hydra-e2e-system-secret/i,
    /e2e-verifier-[a-z0-9-]+/i,
  ];

  for (const file of files) {
    const contents = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(contents, pattern, `${file} contains a committed credential fixture`);
    }
  }
});
