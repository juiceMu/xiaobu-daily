import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function createPreview() {
  let preview: (attachment?: unknown) => Promise<unknown> = async () => {
    throw new Error('未注册预览回调');
  };
  const requests: string[] = [];
  runInNewContext(
    readFileSync(new URL('../testa.js', import.meta.url), 'utf8'),
    {
      setFieldComponentConfig: (
        _field: string,
        config: { getPreviewUrl: typeof preview },
      ) => {
        preview = config.getPreviewUrl;
      },
      getUserInfo: () => ({ organizationId: 1 }),
      window: {
        __env__: { HZERO_HFLE: '/file', API_HOST: 'https://example.test' },
      },
      utils: { getAccessToken: () => 'token' },
      axios: async ({ url }: { url: string }) => {
        requests.push(url);
        return 'signed-url';
      },
      console,
    },
  );
  return { preview, requests };
}

test('附件预览缺少有效地址时返回空结果，不发起请求', async () => {
  const { preview, requests } = createPreview();
  for (const attachment of [
    undefined,
    {},
    { attachment: {} },
    { attachment: { fileUrl: null } },
    { attachment: { fileUrl: '' } },
    { attachment: { fileUrl: 1 } },
  ]) {
    assert.equal(await preview(attachment), undefined);
  }
  assert.deepEqual(requests, []);
});

test('附件预览保留普通文件和 PNG 加签路径', async () => {
  const { preview, requests } = createPreview();
  const attachment = (fileUrl: string) => ({
    bucketName: 'bucket',
    storageCode: 'storage',
    attachment: { fileUrl },
  });
  const result = await preview(attachment('https://example.test/a.pdf'));
  assert.equal(typeof result, 'string');
  assert.ok((result as string).includes('/file-preview/by-url?'));
  assert.equal(requests.length, 0);
  assert.equal(
    await preview(attachment('https://example.test/a.png')),
    'signed-url',
  );
  assert.equal(requests.length, 1);
  assert.ok(requests[0].includes('/files/signedUrl?'));
});
