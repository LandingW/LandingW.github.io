import { test } from "node:test";
import assert from "node:assert/strict";
import sodium from "libsodium-wrappers";
import {
  validatePhotoCredentials,
  encryptGithubSecret,
} from "../scripts/configure-photos.mjs";

test("photo setup rejects wrong credential kinds before writing secrets", () => {
  const values = {
    accessKey: "a".repeat(32),
    secretKey: "b".repeat(64),
    dispatchToken: `github_pat_${"c".repeat(60)}`,
    adminToken: "test-admin-".padEnd(48, "d"),
  };
  assert.doesNotThrow(() => validatePhotoCredentials(values));
  assert.doesNotThrow(() =>
    validatePhotoCredentials({ ...values, adminToken: "a".repeat(12) }),
  );
  assert.throws(() =>
    validatePhotoCredentials({ ...values, adminToken: "a".repeat(11) }),
  );
  assert.throws(() =>
    validatePhotoCredentials({ ...values, accessKey: "not-an-access-key" }),
  );
  assert.throws(() =>
    validatePhotoCredentials({
      ...values,
      dispatchToken: `ghp_${"x".repeat(40)}`,
    }),
  );
  assert.throws(() =>
    validatePhotoCredentials({ ...values, adminToken: "short" }),
  );
  assert.throws(() =>
    validatePhotoCredentials({ ...values, adminToken: values.secretKey }),
  );
});

test("GitHub secret values are sealed to the repository key, not sent as plaintext", async () => {
  await sodium.ready;
  const keys = sodium.crypto_box_keypair();
  const publicKey = sodium.to_base64(
    keys.publicKey,
    sodium.base64_variants.ORIGINAL,
  );
  const value = "synthetic-test-secret-only";
  const encrypted = await encryptGithubSecret(value, publicKey);
  assert.ok(!encrypted.includes(value));
  const decoded = sodium.crypto_box_seal_open(
    sodium.from_base64(encrypted, sodium.base64_variants.ORIGINAL),
    keys.publicKey,
    keys.privateKey,
  );
  assert.equal(sodium.to_string(decoded), value);
});
