export interface LanServiceAddress {
  port: number;
  ipv4?: string[];
  addresses?: string[];
}

export interface LanDiscoveryClient {
  removeListener(
    event: 'resolved',
    listener: (service: LanServiceAddress) => void,
  ): unknown;
  removeListener(
    event: 'error',
    listener: (error: { code?: string | number }) => void,
  ): unknown;
  stop(): void;
  removeDeviceListeners(): void;
}

function isIPv4(address: string) {
  const parts = address.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

export function lanServiceHosts(
  service: LanServiceAddress,
  localAddress: string,
  port: number,
) {
  if (service.port !== port) return [];
  const addresses = service.ipv4?.length
    ? service.ipv4
    : (service.addresses ?? []).filter(isIPv4);
  return [
    ...new Set(
      addresses.filter((host) => isIPv4(host) && host !== localAddress),
    ),
  ];
}

export function createLanHostDeduper() {
  const seen = new Set<string>();
  return (host: string) => {
    if (seen.has(host)) return false;
    seen.add(host);
    return true;
  };
}

export function isPreferredLanDirection(
  localAccountId: string,
  peerAccountId: string,
  direction: 'incoming' | 'outgoing',
) {
  const localFirst = localAccountId.localeCompare(peerAccountId) < 0;
  return direction === (localFirst ? 'outgoing' : 'incoming');
}

export function disposeLanDiscovery(
  discovery: LanDiscoveryClient,
  onResolved: (service: LanServiceAddress) => void,
  onError: (error: { code?: string | number }) => void,
) {
  discovery.removeListener('resolved', onResolved);
  discovery.removeListener('error', onError);
  discovery.stop();
  discovery.removeDeviceListeners();
}
