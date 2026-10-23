import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLanHostDeduper,
  disposeLanDiscovery,
  isPreferredLanDirection,
  lanServiceHosts,
  type LanDiscoveryClient,
} from '../src/state/lanDiscovery';

test('mDNS 只接受目标服务端口、有效IPv4并排除本机及重复地址', () => {
  assert.deepEqual(
    lanServiceHosts(
      {
        port: 39217,
        ipv4: ['192.168.1.4', '192.168.1.4', '192.168.1.5'],
        addresses: ['192.168.1.6'],
      },
      '192.168.1.4',
      39217,
    ),
    ['192.168.1.5'],
  );
  assert.deepEqual(
    lanServiceHosts(
      { port: 39218, addresses: ['192.168.1.6', 'fe80::1'] },
      '192.168.1.4',
      39217,
    ),
    [],
  );
});

test('LAN 扫描按地址去重，避免 mDNS 与网段回退重复建连', () => {
  const seen = createLanHostDeduper();
  assert.equal(seen('192.168.1.8'), true);
  assert.equal(seen('192.168.1.8'), false);
  assert.equal(seen('192.168.1.9'), true);
});

test('交叉连接由账户排序选出同一优先方向，单边发起仍有回退方向', () => {
  assert.equal(
    isPreferredLanDirection('account-a', 'account-b', 'outgoing'),
    true,
  );
  assert.equal(
    isPreferredLanDirection('account-b', 'account-a', 'incoming'),
    true,
  );
  assert.equal(
    isPreferredLanDirection('account-a', 'account-b', 'incoming'),
    false,
  );
  assert.equal(
    isPreferredLanDirection('account-b', 'account-a', 'outgoing'),
    false,
  );
  assert.equal(
    isPreferredLanDirection('account-b', 'account-a', 'outgoing'),
    false,
  );
});

test('mDNS 扫描结束时移除监听并停止原生发现器', () => {
  const calls: string[] = [];
  const discovery: LanDiscoveryClient = {
    removeListener: (event) => {
      calls.push(`remove:${event}`);
    },
    stop: () => calls.push('stop'),
    removeDeviceListeners: () => calls.push('removeDeviceListeners'),
  };
  disposeLanDiscovery(
    discovery,
    () => undefined,
    () => undefined,
  );
  assert.deepEqual(calls, [
    'remove:resolved',
    'remove:error',
    'stop',
    'removeDeviceListeners',
  ]);
});

test('mDNS 使用addresses回退时忽略IPv6和无效IPv4', () => {
  assert.deepEqual(
    lanServiceHosts(
      { port: 39217, addresses: ['fe80::1', '192.168.1.300', '10.0.0.8'] },
      '10.0.0.7',
      39217,
    ),
    ['10.0.0.8'],
  );
});
