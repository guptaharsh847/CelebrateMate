import type { Category } from '@/types';
import { CATEGORY_META } from '@/utils/constants';
import { cn, initials } from '@/utils/cn';

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
};

interface AvatarProps {
  name: string;
  category: Category;
  size?: keyof typeof SIZES;
  muted?: boolean;
  className?: string;
}

export function Avatar({ name, category, size = 'md', muted, className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        muted ? 'bg-gray-100 text-gray-400' : CATEGORY_META[category].avatar,
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
