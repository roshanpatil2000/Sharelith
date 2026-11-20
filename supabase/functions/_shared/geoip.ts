// Approximate location for an IP address, for sign-in alert emails.
// Uses ipinfo.io: the IP is the only thing sent. Optional secret IPINFO_TOKEN
// raises the free rate limit.

const PRIVATE =
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;

export function formatPlace(info: {
  city?: string;
  region?: string;
  country?: string;
}): string | null {
  const parts = [info.city, info.region, info.country].filter(
    (p, i, all): p is string => !!p && all.indexOf(p) === i,
  );
  return parts.length ? parts.join(', ') : null;
}

export async function locateIp(
  ip: string,
  token = Deno.env.get('IPINFO_TOKEN') ?? '',
): Promise<string | null> {
  if (!ip || PRIVATE.test(ip)) {
    return null;
  }
  const url = `https://ipinfo.io/${encodeURIComponent(ip)}/json${
    token ? `?token=${token}` : ''
  }`;
  const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
  if (!res.ok) {
    return null;
  }
  return formatPlace(await res.json());
}
