import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  patchInstalledTcpSocket,
  patchTcpSocket,
} from '../scripts/patch-tcp-socket.mjs';

const original =
  '                TcpSocketClient socketClient = getTcpClient(cId);\n                socketClient.destroy();';

test('LAN-012: patch is idempotent and rejects source drift', () => {
  const patched = patchTcpSocket(original);
  assert.match(patched, /socketMap.get\(cId\)/);
  assert.match(patched, /if \(socket instanceof TcpSocketClient\)/);
  assert.doesNotMatch(patched, /getTcpClient/);
  assert.equal(patchTcpSocket(patched), patched);
  assert.throws(
    () => patchTcpSocket('unexpected upstream source'),
    /no longer matches/,
  );
  assert.throws(() => patchTcpSocket(original + original), /no longer matches/);
});

test('LAN-012: installation checks dependency version and preserves unknown source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xiaobu-tcp-patch-'));
  const directory = join(root, 'node_modules/react-native-tcp-socket');
  const sourceDirectory = join(
    directory,
    'android/src/main/java/com/asterinet/react/tcpsocket',
  );
  await mkdir(sourceDirectory, { recursive: true });
  const path = join(sourceDirectory, 'TcpSocketModule.java');
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ version: '6.4.3' }),
  );
  await writeFile(path, original);
  await patchInstalledTcpSocket(root);
  assert.equal(await readFile(path, 'utf8'), patchTcpSocket(original));
  await patchInstalledTcpSocket(root);
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ version: '6.4.4' }),
  );
  await assert.rejects(patchInstalledTcpSocket(root), /dependency version/);
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ version: '6.4.3' }),
  );
  await writeFile(path, 'unknown source');
  await assert.rejects(patchInstalledTcpSocket(root), /no longer matches/);
  assert.equal(await readFile(path, 'utf8'), 'unknown source');
});
