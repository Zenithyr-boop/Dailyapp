import type { Rank } from '../lib/rank'

interface RankBadgeProps {
  rank: Rank
  size?: 'sm' | 'lg'
}

/** Square rank letter in the rank colour. */
export function RankBadge({ rank, size = 'sm' }: RankBadgeProps) {
  const box = size === 'lg' ? 'size-14 text-3xl' : 'size-9 text-xl'
  return (
    <div
      className={`grid shrink-0 place-items-center border-2 border-rank font-display font-extrabold text-rank ${box}`}
      aria-label={`Rank ${rank}`}
      role="img"
    >
      {rank}
    </div>
  )
}
