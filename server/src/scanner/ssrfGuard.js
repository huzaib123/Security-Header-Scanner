import dns from 'node:dns/promises';
import net from 'node:net';

// Address ranges a scan must never reach: loopback, private networks,
// link-local (including cloud metadata at 169.254.169.254), carrier-grade
// NAT, multicast and reserved space, for both IPv4 and IPv6.
const blocked = new net.BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([addr, prefix]) => blocked.addSubnet(addr, prefix, 'ipv4'));
[
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['64:ff9b::', 96],
].forEach(([addr, prefix]) => blocked.addSubnet(addr, prefix, 'ipv6'));

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set(['', '80', '443']);

export class BlockedTargetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BlockedTargetError';
  }
}

export function isBlockedIp(ip) {
  const family = net.isIP(ip);
  if (family === 0) return true;
  if (family === 6) {
    // IPv4-mapped IPv6 such as ::ffff:127.0.0.1 must be checked as IPv4.
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return blocked.check(mapped[1], 'ipv4');
    return blocked.check(ip, 'ipv6');
  }
  return blocked.check(ip, 'ipv4');
}

// Checks the parts of a URL that can be judged without DNS.
export function assertAllowedUrl(url, { allowPrivate = false } = {}) {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new BlockedTargetError('Only http and https addresses can be scanned');
  if (url.username || url.password) throw new BlockedTargetError('Addresses with credentials are not allowed');
  if (allowPrivate) return;
  if (!ALLOWED_PORTS.has(url.port)) throw new BlockedTargetError('Only the standard ports 80 and 443 can be scanned');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new BlockedTargetError('Internal hostnames cannot be scanned');
  }
  if (net.isIP(host) && isBlockedIp(host)) throw new BlockedTargetError('Private or reserved IP addresses cannot be scanned');
}

// Resolves the hostname and refuses it if any address is private.
export async function assertPublicHost(hostname, { allowPrivate = false } = {}) {
  const host = hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try {
    addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new BlockedTargetError(`Could not resolve ${host}`);
  }
  if (!allowPrivate && addresses.some(({ address }) => isBlockedIp(address))) {
    throw new BlockedTargetError('This address points to a private or reserved network and cannot be scanned');
  }
  return addresses.map(({ address }) => address);
}

// DNS lookup for the HTTP client. Every connection, including each redirect
// hop, goes through here, and the checked address is the one connected to,
// so a DNS answer cannot change between the check and the request
// (DNS rebinding).
export function createGuardedLookup({ allowPrivate = false } = {}) {
  return (hostname, options, callback) => {
    dns
      .lookup(hostname, { ...options, all: true, verbatim: true })
      .then((addresses) => {
        const allowed = allowPrivate ? addresses : addresses.filter(({ address }) => !isBlockedIp(address));
        if (allowed.length === 0) {
          throw new BlockedTargetError(`${hostname} resolves to a private or reserved address`);
        }
        if (options?.all) callback(null, allowed);
        else callback(null, allowed[0].address, allowed[0].family);
      })
      .catch((err) => callback(err));
  };
}
