import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeSigningProvider } from '../src/domain/identity';

test('原生签名provider只转发签名契约，不暴露私钥', async () => {
  const calls: string[] = [];
  const provider = createNativeSigningProvider({
    async getIdentity() {
      calls.push('getIdentity');
      return null;
    },
    async createIdentity() {
      calls.push('createIdentity');
      return {
        accountId: 'id-12345678',
        publicKey: 'public',
        fingerprint: '12345678',
        keyEpoch: 1,
      };
    },
    async sign(payload) {
      calls.push(`sign:${payload}`);
      return 'signature';
    },
    async verify(publicKey, payload, signature) {
      calls.push(`verify:${publicKey}:${payload}:${signature}`);
      return true;
    },
    async forgetIdentity() {
      calls.push('forgetIdentity');
    },
  });
  assert.equal(typeof provider.getIdentity, 'function');
  assert.equal(typeof provider.createIdentity, 'function');
  assert.equal(typeof provider.sign, 'function');
  assert.equal(typeof provider.verify, 'function');
  assert.equal(typeof provider.forgetIdentity, 'function');
  assert.equal('privateKey' in provider, false);
  assert.equal(await provider.sign(new Uint8Array([65])), 'signature');
  assert.equal(
    await provider.verify('public', new Uint8Array([65]), 'signature'),
    true,
  );
  assert.deepEqual(calls, ['sign:QQ==', 'verify:public:QQ==:signature']);
});
