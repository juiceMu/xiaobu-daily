/**
 * V1 身份服务契约。
 * 私钥只允许由实现方持有；领域层只接收公钥、指纹和签名结果。
 * 原生实现必须把 sign 放在 Keychain/Android Keystore 中，禁止返回私钥。
 */
export interface SigningIdentity {
  accountId: string;
  publicKey: string;
  fingerprint: string;
  keyEpoch: number;
}

export interface SigningKeyProvider {
  getIdentity(): Promise<SigningIdentity | null>;
  createIdentity(): Promise<SigningIdentity>;
  sign(payload: Uint8Array): Promise<string>;
  verify(
    publicKey: string,
    payload: Uint8Array,
    signature: string,
  ): Promise<boolean>;
  /** 私钥丢失时只能创建新身份，不得沿用旧 accountId。 */
  forgetIdentity(): Promise<void>;
}

export interface NativeSigningIdentityModule {
  getIdentity(): Promise<SigningIdentity | null>;
  createIdentity(): Promise<SigningIdentity>;
  sign(payloadBase64: string): Promise<string>;
  verify(
    publicKeyBase64: string,
    payloadBase64: string,
    signatureBase64: string,
  ): Promise<boolean>;
  forgetIdentity(): Promise<void>;
}

const bytesToBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

export function createNativeSigningProvider(
  module: NativeSigningIdentityModule,
): SigningKeyProvider {
  return {
    getIdentity: () => module.getIdentity(),
    createIdentity: () => module.createIdentity(),
    sign: (value) => module.sign(bytesToBase64(value)),
    verify: (publicKey, value, signature) =>
      module.verify(publicKey, bytesToBase64(value), signature),
    forgetIdentity: () => module.forgetIdentity(),
  };
}

const encoder = new TextEncoder();
const cryptoBytesToBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export function canonicalIdentityPayload(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

/**
 * 仅供 WebCrypto/测试实现使用。extractable=false 让 CryptoKey 不能被导出；
 * 原生端仍应替换为系统 Keychain/Keystore provider。
 */
export function createWebCryptoProvider(
  cryptoApi: Crypto = globalThis.crypto,
): SigningKeyProvider {
  if (!cryptoApi?.subtle) throw new Error('当前平台没有不可导出的签名密钥服务');
  let keyPair: CryptoKeyPair | undefined;
  let identity: SigningIdentity | null = null;
  const fingerprint = async (publicKey: string) => {
    const digest = await cryptoApi.subtle.digest(
      'SHA-256',
      base64ToBytes(publicKey),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
  };
  const publicKey = async (key: CryptoKey) =>
    cryptoBytesToBase64(
      new Uint8Array(await cryptoApi.subtle.exportKey('spki', key)),
    );
  return {
    async getIdentity() {
      return identity;
    },
    async createIdentity() {
      keyPair = await cryptoApi.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );
      const encoded = await publicKey(keyPair.publicKey);
      const id = await fingerprint(encoded);
      identity = {
        accountId: `id-${id.slice(0, 32)}`,
        publicKey: encoded,
        fingerprint: id,
        keyEpoch: 1,
      };
      return identity;
    },
    async sign(payload) {
      if (!keyPair || !identity) throw new Error('签名身份尚未初始化');
      const signature = await cryptoApi.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        payload as unknown as BufferSource,
      );
      return cryptoBytesToBase64(new Uint8Array(signature));
    },
    async verify(encodedPublicKey, payload, signature) {
      const key = await cryptoApi.subtle.importKey(
        'spki',
        base64ToBytes(encodedPublicKey),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      return cryptoApi.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        base64ToBytes(signature),
        payload as unknown as BufferSource,
      );
    },
    async forgetIdentity() {
      keyPair = undefined;
      identity = null;
    },
  };
}
