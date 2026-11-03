import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  patchInstalledTcpSocket,
  patchTcpServer,
  patchTcpSocket,
} from '../scripts/patch-tcp-socket.mjs';

const original =
  '                TcpSocketClient socketClient = getTcpClient(cId);\n                socketClient.destroy();';
const originalServer = `    private ServerSocket serverSocket;
    public void close() {
        try {
            // close the socket
            if (serverSocket != null && !serverSocket.isClosed()) {
                serverSocket.close();
                mReceiverListener.onClose(getId(), null);
                serverSocket = null;
            }
        } catch (IOException e) {
            mReceiverListener.onClose(getId(), e);
        }
    }`;

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

test('LAN-015: server patch keeps a stable reference and serializes close', () => {
  const patched = patchTcpServer(originalServer);
  assert.match(patched, /private final ServerSocket serverSocket;/);
  assert.match(patched, /public synchronized void close\(\)/);
  assert.match(patched, /if \(!serverSocket\.isClosed\(\)\)/);
  assert.doesNotMatch(patched, /serverSocket = null/);
  assert.equal(patchTcpServer(patched), patched);
  assert.throws(() => patchTcpServer('unknown source'), /no longer matches/);
  assert.throws(
    () => patchTcpServer(originalServer + originalServer),
    /no longer matches/,
  );
  assert.throws(
    () =>
      patchTcpServer(
        originalServer.replace(
          'private ServerSocket',
          'private final ServerSocket',
        ),
      ),
    /no longer matches/,
  );
  assert.throws(() => patchTcpServer(patched + patched), /no longer matches/);
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
  const serverPath = join(sourceDirectory, 'TcpSocketServer.java');
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ version: '6.4.3' }),
  );
  await writeFile(path, original);
  await writeFile(serverPath, originalServer);
  await patchInstalledTcpSocket(root);
  assert.equal(await readFile(path, 'utf8'), patchTcpSocket(original));
  assert.equal(
    await readFile(serverPath, 'utf8'),
    patchTcpServer(originalServer),
  );
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
  await writeFile(path, original);
  await writeFile(serverPath, 'unknown server source');
  await assert.rejects(patchInstalledTcpSocket(root), /no longer matches/);
  assert.equal(await readFile(path, 'utf8'), original);
  assert.equal(await readFile(serverPath, 'utf8'), 'unknown server source');
});
