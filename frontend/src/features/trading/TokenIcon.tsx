import { useState } from 'react'

export function TokenIcon({ symbol, iconUrl }: { symbol: string; iconUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return <span className="terminal-token-mark" aria-hidden="true">{iconUrl && iconUrl !== failedUrl
    ? <img src={iconUrl} alt="" width={36} height={36} decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(iconUrl)} />
    : symbol.length <= 4 ? symbol : symbol.slice(0, 2)}</span>
}
