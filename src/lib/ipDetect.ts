// ipDetect.ts — 统一 IP 检测
// 优先使用国内可达的服务，逐级降级

export async function detectPublicIp(): Promise<string> {
  const sources = [
    { url: 'https://httpbin.org/ip', parse: (d: any) => d.origin?.split(',')[0]?.trim() },
    { url: 'https://myip.ipip.net/json', parse: (d: any) => d.data?.ip || d.ip },
    { url: 'https://ipapi.co/json/', parse: (d: any) => d.ip },
  ]
  for (const src of sources) {
    try {
      const r = await fetch(src.url, { signal: AbortSignal.timeout(5000) })
      const d = await r.json()
      const ip = src.parse(d)
      if (ip && typeof ip === 'string' && ip.length > 0) return ip.split(',')[0].trim()
    } catch {}
  }
  return ''
}

export async function detectGeoInfo(ip: string): Promise<{country:string;province:string;city:string;isp:string}> {
  if (!ip) return { country: '未知', province: '未知', city: '未知', isp: '未知' }
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(5000) })
    const d = await r.json()
    if (!d.error) return {
      country: d.country_name || '未知',
      province: d.region || '未知',
      city: d.city || '未知',
      isp: d.org || '未知',
    }
  } catch {}
  return { country: '未知', province: '未知', city: '未知', isp: '未知' }
}
