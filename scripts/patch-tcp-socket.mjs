import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 6.4.3 may emit an error before registering a socket. Its JS error handler
// still calls destroy(), so native end() must accept an already absent client.
export function patchTcpSocket(source) {
  const before =
    '                TcpSocketClient socketClient = getTcpClient(cId);\n                socketClient.destroy();';
  const after =
    '                // smallsteps: closing a failed/already removed socket is a no-op.\n                TcpSocket socket = socketMap.get(cId);\n                if (socket instanceof TcpSocketClient) {\n                    ((TcpSocketClient) socket).destroy();\n                }';
  if (source.includes(after)) return source;
  if (source.split(before).length !== 2)
    throw new Error(
      'TCP native patch no longer matches; review dependency before building',
    );
  return source.replace(before, after);
}

export async function patchInstalledTcpSocket(root = process.cwd()) {
  const directory = resolve(root, 'node_modules/react-native-tcp-socket');
  const pkg = JSON.parse(
    await readFile(resolve(directory, 'package.json'), 'utf8'),
  );
  if (pkg.version !== '6.4.3')
    throw new Error('Review TCP native patch for this dependency version');
  const path = resolve(
    directory,
    'android/src/main/java/com/asterinet/react/tcpsocket/TcpSocketModule.java',
  );
  const source = await readFile(path, 'utf8');
  const patched = patchTcpSocket(source);
  if (patched !== source) await writeFile(path, patched);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  patchInstalledTcpSocket().then(
    () => console.log('TCP Android cleanup patch verified'),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
