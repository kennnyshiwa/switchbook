import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productionComposeFiles = [
  "docker-compose.yml",
  "docker-backup/docker-compose-ghcr.yml",
  "docker-backup/docker-compose-original.yml",
];

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
