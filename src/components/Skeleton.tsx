import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const roundedMap = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
};

export function Skeleton({ className = '', style, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer bg-brand-beige/50 ${roundedMap[rounded]} ${className}`}
      style={style}
      aria-hidden
    />
  );
}
