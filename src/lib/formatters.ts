// Client-side deterministic formatters and relative time calculator (Bug fix h)
export function formatMoney(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
  return `$${val.toFixed(0)}`
}

export function formatTimeAgo(isoString: string): string {
  if (!isoString) return 'recently'
  const past = new Date(isoString).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.floor((now - past) / 1000))

  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return `${Math.floor(diffDay / 30)}mo ago`
}
