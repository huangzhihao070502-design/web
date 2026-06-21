// ipDetect.ts — 统一 IP 检测，不再依赖 httpbin.org

export async function detectPublicIp(): Promise<string> {
  const sources = [
    { url: 'https://api.ipify.org?format=json', parse: (d: any) => d.ip },
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
