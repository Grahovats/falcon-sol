import Avatar from 'boring-avatars'

type SolanaAccountIconSize = 'sm' | 'md' | 'lg' | 'xl'

interface SolanaAccountIconProps {
  address: string
  size?: SolanaAccountIconSize
  className?: string
}

const sizeClasses: Record<SolanaAccountIconSize, string> = {
  sm: 'size-5',
  md: 'size-8',
  lg: 'size-12',
  xl: 'size-20',
}

// Boring Avatars requires literal color values to generate each SVG palette.
const accountColors = ['#3157ff', '#f5d328', '#ef5a47', '#2ac69b', '#9a62e8']

/** A deterministic Boring Avatars identicon seeded by a Solana account address. */
export function SolanaAccountIcon({ address, size = 'md', className = '' }: SolanaAccountIconProps) {
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-white/15 ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    >
      <Avatar name={address} variant="marble" colors={accountColors} size="100%" />
    </span>
  )
}
