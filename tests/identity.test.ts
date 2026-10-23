import { webcrypto } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalIdentityPayload,
  createWebCryptoProvider,
} from '../src/domain/identity';

test('WebCrypto身份生成不可导出私钥并绑定公钥指纹', async () => {
  const provider = createWebCryptoProvider(webcrypto as unknown as Crypto);
  const identity = await provider.createIdentity();
  const payload = canonicalIdentityPayload({ groupId: 'group-identity-01' });
  const signature = await provider.sign(payload);
  assert.equal(
    await provider.verify(identity.publicKey, payload, signature),
    true,
  );
  assert.equal('exportPrivateKey' in provider, false);
});

test('私钥丢失后必须生成新的accountId', async () => {
  const provider = createWebCryptoProvider(webcrypto as unknown as Crypto);
  const oldIdentity = await provider.createIdentity();
  await provider.forgetIdentity();
  const newIdentity = await provider.createIdentity();
  assert.notEqual(newIdentity.accountId, oldIdentity.accountId);
  assert.notEqual(newIdentity.fingerprint, oldIdentity.fingerprint);
});
