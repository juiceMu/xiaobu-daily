import TcpSocket from 'react-native-tcp-socket';
import * as Network from 'expo-network';
import Zeroconf, { ImplType } from 'react-native-zeroconf';
import { Platform } from 'react-native';
import type { AccountJournal } from '../domain/syncModel';
import { runLanSession } from './lanProtocol';
import type { LanSessionOptions } from './lanProtocol';
import type { LanExchange } from './lanExchange';
import { createLanChannel, LAN_SESSION_TIMEOUT_MS } from './lanTransport';
import type { LanSocket } from './lanTransport';
import {
  createLanHostDeduper,
  disposeLanDiscovery,
  isPreferredLanDirection,
  lanServiceHosts,
} from './lanDiscovery';

const PORT = 39217;
const SERVICE_TYPE = 'sprout-checkin';
const SERVICE_NAME = 'Small Steps Sync';
const NOT_FOUND = '同一 WiFi 下没找到其他手机，请确认两台设备已连接同一 WiFi';
let sessionLocked = false;

function wifiInterface() {
  return Platform.OS === 'ios' ? 'en0' : 'wlan0';
}

function lanPrefix(ip: string) {
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part)))
    return '';
  const numbers = parts.map(Number);
  const [first, second] = numbers;
  const privateRange =
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
  if (!privateRange || numbers.some((part) => part > 255)) return '';
  return parts.slice(0, 3).join('.');
}

async function wifiAddress() {
  let ip: string;
  try {
    ip = await Network.getIpAddressAsync();
  } catch {
    throw new Error('无法读取 WiFi 地址，请确认设备已连接 WiFi');
  }
  if (!lanPrefix(ip))
    throw new Error(
      '未检测到可用 WiFi IPv4 地址；蜂窝网络和 IPv6 暂不支持小组同步',
    );
  return ip;
}

function runWithDeadline<T>(promise: Promise<T>, socket: LanSocket) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('同步传输超时'));
    }, LAN_SESSION_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function withSessionLock(
  options: LanSessionOptions,
  direction: 'incoming' | 'outgoing',
): LanSessionOptions {
  let ownsLock = false;
  return {
    ...options,
    onSessionStart: async (input, peerAccountId) => {
      if (!isPreferredLanDirection(input.accountId, peerAccountId, direction))
        await new Promise((resolve) => setTimeout(resolve, 750));
      if (sessionLocked)
        throw Object.assign(new Error('本机正在同步，请稍后再试'), {
          code: 'SESSION_BUSY',
        });
      sessionLocked = true;
      ownsLock = true;
      try {
        await options.onSessionStart?.(input, peerAccountId);
      } catch (error) {
        ownsLock = false;
        sessionLocked = false;
        throw error;
      }
    },
    onSessionEnd: async () => {
      try {
        await options.onSessionEnd?.();
      } finally {
        if (ownsLock) {
          ownsLock = false;
          sessionLocked = false;
        }
      }
    },
  };
}

function runPeerSession(
  socket: LanSocket,
  input: LanExchange,
  options: LanSessionOptions,
  direction: 'incoming' | 'outgoing',
) {
  const channel = createLanChannel(socket);
  return runWithDeadline(
    runLanSession(channel, input, withSessionLock(options, direction)),
    socket,
  ).finally(() => socket.destroy());
}

export interface LanListenerOptions extends LanSessionOptions {
  getInput: () => LanExchange | null;
  onError?: (error: Error) => void;
}

export function startLanListener(options: LanListenerOptions): () => void {
  let stopped = false;
  let server: ReturnType<typeof TcpSocket.createServer> | null = null;
  let revision = 0;
  let opening = false;
  const sockets = new Set<LanSocket>();
  let zeroconf: Zeroconf | null = null;
  try {
    zeroconf = new Zeroconf();
  } catch {
    options.onError?.(new Error('本机尚未包含 mDNS 模块；请重新构建原生应用'));
  }
  let publishedName: string | null = null;
  let discoveryDisposed = false;
  const report = (error: unknown) => {
    if (
      (error as { code?: string })?.code === 'AUTH_FAILED' ||
      (error as { code?: string })?.code === 'SESSION_BUSY'
    )
      return;
    if (!stopped)
      options.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
  };
  const closeServer = () => {
    for (const socket of sockets) socket.destroy();
    sockets.clear();
    if (!server) return;
    const current = server;
    server = null;
    try {
      current.close();
    } catch {
      // 尚未监听时 close 会同步报错，无需继续保留实例。
    }
  };
  const refresh = async () => {
    const currentRevision = ++revision;
    if (opening) return;
    opening = true;
    try {
      closeServer();
      const ip = await wifiAddress();
      if (stopped || currentRevision !== revision || !options.getInput())
        return;
      const nextServer = TcpSocket.createServer((rawSocket) => {
        const socket = rawSocket as unknown as LanSocket;
        sockets.add(socket);
        const input = options.getInput();
        if (!input) {
          socket.destroy();
          sockets.delete(socket);
          return;
        }
        void runPeerSession(socket, input, options, 'incoming')
          .catch(report)
          .finally(() => sockets.delete(socket));
      });
      nextServer.once('error', report);
      nextServer.listen({ port: PORT, host: ip, reuseAddress: true }, () => {
        if (stopped || currentRevision !== revision) {
          nextServer.close();
          return;
        }
        server = nextServer;
        if (zeroconf && !publishedName && !discoveryDisposed) {
          const discovery = zeroconf;
          const publish = (useInterface: boolean) =>
            discovery.publishService({
              type: SERVICE_TYPE,
              protocol: 'tcp',
              name: SERVICE_NAME,
              port: PORT,
              txt: { version: '2' },
              ...(useInterface ? { networkInterface: wifiInterface() } : {}),
              ...(Platform.OS === 'android'
                ? { implType: ImplType.DNSSD }
                : {}),
            });
          void publish(true)
            .then((service) => {
              if (discoveryDisposed) {
                void discovery
                  .unpublishService(service.name)
                  .catch(() => undefined);
              } else {
                publishedName = service.name;
              }
            })
            .catch(async (error: unknown) => {
              const code = (error as { code?: string })?.code;
              if (code !== 'UNKNOWN_INTERFACE' && code !== 'UNSUPPORTED') {
                report(error);
                return;
              }
              try {
                const service = await publish(false);
                if (discoveryDisposed)
                  await discovery.unpublishService(service.name);
                else publishedName = service.name;
              } catch (fallbackError) {
                report(fallbackError);
              }
            });
        }
      });
    } catch (error) {
      report(error);
    } finally {
      opening = false;
      if (!stopped && currentRevision !== revision) void refresh();
    }
  };
  const subscription = Network.addNetworkStateListener(() => void refresh());
  void refresh();
  return () => {
    stopped = true;
    revision += 1;
    subscription.remove();
    closeServer();
    discoveryDisposed = true;
    const name = publishedName;
    publishedName = null;
    if (name && zeroconf)
      void zeroconf.unpublishService(name).catch(() => undefined);
    zeroconf?.removeDeviceListeners();
  };
}

function connectHost(
  host: string,
  input: LanExchange,
  options: LanSessionOptions,
) {
  return new Promise<{ accountId: string; journals: AccountJournal[] } | null>(
    (resolve, reject) => {
      let settled = false;
      let socket: LanSocket;
      const finish = (
        error?: Error,
        result?: { accountId: string; journals: AccountJournal[] },
      ) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(result ?? null);
      };
      const rawSocket = TcpSocket.createConnection(
        { port: PORT, host, interface: 'wifi', connectTimeout: 2_000 },
        () => {
          void runPeerSession(socket, input, options, 'outgoing')
            .then((result) => finish(undefined, result))
            .catch((error: unknown) => {
              finish(error instanceof Error ? error : new Error(String(error)));
              socket.destroy();
            });
        },
      );
      socket = rawSocket as unknown as LanSocket;
      rawSocket.on('error', (error) => finish(error));
      rawSocket.on('close', () => finish());
      rawSocket.on('timeout', () => {
        socket.destroy();
        finish(new Error('同步连接空闲超时'));
      });
    },
  );
}

export async function exchangeOnLan(
  input: LanExchange,
  options: LanSessionOptions,
): Promise<AccountJournal[]> {
  const ip = await wifiAddress();
  const prefix = lanPrefix(ip);
  const found = new Map<string, AccountJournal[]>();
  const rejected = { auth: false };
  const sawBusySession = { current: false };
  const inFlightHosts = new Map<string, Promise<void>>();
  const markAttempted = createLanHostDeduper();
  const attemptHost = (host: string) => {
    const current = inFlightHosts.get(host);
    if (current) return current;
    if (!markAttempted(host)) return Promise.resolve();
    const attempt = async () => {
      let retry = 0;
      while (retry <= 3) {
        try {
          const result = await connectHost(host, input, options);
          if (result) found.set(result.accountId, result.journals);
          return;
        } catch (error) {
          const code = (error as { code?: string })?.code;
          if (code === 'AUTH_FAILED') rejected.auth = true;
          if (code !== 'SESSION_BUSY') return;
          sawBusySession.current = true;
          if (retry === 3) return;
          await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** retry));
          retry += 1;
        }
      }
    };
    const pending = attempt().finally(() => inFlightHosts.delete(host));
    inFlightHosts.set(host, pending);
    return pending;
  };
  let zeroconf: Zeroconf | null = null;
  try {
    zeroconf = new Zeroconf();
  } catch {
    // /24 扫描仍可用于旧安装包及 Expo Go 开发。
  }
  const discoveryTasks: Promise<void>[] = [];
  const discoveredHosts = new Set<string>();
  const resolved = (service: Parameters<typeof lanServiceHosts>[0]) => {
    for (const host of lanServiceHosts(service, ip, PORT))
      discoveredHosts.add(host);
  };
  const onDiscoveryError = (error: { code?: string | number }) => {
    if (error.code === 'UNKNOWN_INTERFACE' || error.code === 'UNSUPPORTED') {
      zeroconf?.scan({ type: SERVICE_TYPE, protocol: 'tcp', domain: 'local.' });
    }
  };
  zeroconf?.on('resolved', resolved);
  zeroconf?.on('error', onDiscoveryError);
  let discoveryWindow: Promise<void> = Promise.resolve();
  try {
    if (zeroconf) {
      try {
        zeroconf.scan({
          type: SERVICE_TYPE,
          protocol: 'tcp',
          domain: 'local.',
          resolveTimeout: 4,
          networkInterface: wifiInterface(),
          ...(Platform.OS === 'android' ? { implType: ImplType.DNSSD } : {}),
        });
      } catch {
        zeroconf.stop();
      }
      discoveryWindow = new Promise<void>((resolve) => {
        setTimeout(resolve, 8_000);
      });
      await discoveryWindow;
      zeroconf.stop();
      for (const host of discoveredHosts)
        discoveryTasks.push(attemptHost(host));
      await Promise.allSettled(discoveryTasks);
    }
    if (!found.size) {
      const hosts = Array.from(
        { length: 254 },
        (_, index) => `${prefix}.${index + 1}`,
      ).filter((host) => host !== ip);
      let cursor = 0;
      const worker = async () => {
        while (cursor < hosts.length) {
          const host = hosts[cursor++];
          await attemptHost(host);
        }
      };
      await Promise.all(Array.from({ length: 24 }, () => worker()));
    }
    zeroconf?.stop();
    await Promise.allSettled([...discoveryTasks, ...inFlightHosts.values()]);
  } finally {
    if (zeroconf) disposeLanDiscovery(zeroconf, resolved, onDiscoveryError);
  }
  const journals = [...found.values()].flat();
  if (!journals.length)
    throw new Error(
      rejected.auth
        ? '小组口令不一致'
        : sawBusySession.current
          ? '本机正在同步，请稍后重试'
          : NOT_FOUND,
    );
  return journals;
}
