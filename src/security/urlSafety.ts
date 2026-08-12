import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
const METADATA_IPS = new Set(["169.254.169.254", "100.100.100.200"]);

function ipToNumber(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inRange(ip: string, start: string, end: string): boolean {
  const value = ipToNumber(ip);
  return value >= ipToNumber(start) && value <= ipToNumber(end);
}

export function isPrivateIp(ip: string): boolean {
  if (METADATA_IPS.has(ip)) return true;
  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }
  if (net.isIP(ip) !== 4) return true;
  return (
    inRange(ip, "10.0.0.0", "10.255.255.255") ||
    inRange(ip, "127.0.0.0", "127.255.255.255") ||
    inRange(ip, "172.16.0.0", "172.31.255.255") ||
    inRange(ip, "192.168.0.0", "192.168.255.255") ||
    inRange(ip, "169.254.0.0", "169.254.255.255") ||
    inRange(ip, "0.0.0.0", "0.255.255.255")
  );
}

export async function assertSafePublicUrl(input: string): Promise<URL> {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) {
    throw new Error("Local or internal hostnames are blocked.");
  }
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("Private and metadata IP addresses are blocked.");
  }
  const records = await lookup(hostname, { all: true });
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error("The URL resolves to a private or metadata IP address.");
  }
  return url;
}

export function assertSameOrigin(base: URL, next: URL): void {
  if (base.origin !== next.origin) {
    throw new Error("Redirects and crawled links must stay on the submitted domain.");
  }
}
