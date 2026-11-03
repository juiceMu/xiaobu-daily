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

// 关闭服务端时保留稳定引用，避免监听线程和事件回调取得空引用。
export function patchTcpServer(source) {
  const fieldBefore = '    private ServerSocket serverSocket;';
  const fieldAfter = '    private final ServerSocket serverSocket;';
  const closeBefore = `    public void close() {
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
  const closeAfter = `    public synchronized void close() {
        try {
            // close the socket
            if (!serverSocket.isClosed()) {
                serverSocket.close();
                mReceiverListener.onClose(getId(), null);
            }
        } catch (IOException e) {
            mReceiverListener.onClose(getId(), e);
        }
    }`;
  const count = (text) => source.split(text).length - 1;
  if (
    count(fieldAfter) === 1 &&
    count(closeAfter) === 1 &&
    count(fieldBefore) === 0 &&
    count(closeBefore) === 0
  )
    return source;
  if (
    count(fieldBefore) !== 1 ||
    count(closeBefore) !== 1 ||
    count(fieldAfter) !== 0 ||
    count(closeAfter) !== 0
  )
    throw new Error(
      'TCP server native patch no longer matches; review dependency before building',
    );
  return source
    .replace(fieldBefore, fieldAfter)
    .replace(closeBefore, closeAfter);
}

export async function patchInstalledTcpSocket(root = process.cwd()) {
  const directory = resolve(root, 'node_modules/react-native-tcp-socket');
  const pkg = JSON.parse(
    await readFile(resolve(directory, 'package.json'), 'utf8'),
  );
  if (pkg.version !== '6.4.3')
    throw new Error('Review TCP native patch for this dependency version');
  const modulePath = resolve(
    directory,
    'android/src/main/java/com/asterinet/react/tcpsocket/TcpSocketModule.java',
  );
  const serverPath = resolve(
    directory,
    'android/src/main/java/com/asterinet/react/tcpsocket/TcpSocketServer.java',
  );
  const [moduleSource, serverSource] = await Promise.all([
    readFile(modulePath, 'utf8'),
    readFile(serverPath, 'utf8'),
  ]);
  // 两个源码均校验成功后才写入，避免版本漂移时留下部分补丁。
  const patchedModule = patchTcpSocket(moduleSource);
  const patchedServer = patchTcpServer(serverSource);
  if (patchedModule !== moduleSource)
    await writeFile(modulePath, patchedModule);
  if (patchedServer !== serverSource)
    await writeFile(serverPath, patchedServer);
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
