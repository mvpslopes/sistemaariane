const sizeMap = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-20 w-20 text-2xl',
} as const;

interface UserAvatarProps {
  name: string;
  size?: keyof typeof sizeMap;
  className?: string;
}

export default function UserAvatar({ name, size = 'md', className = '' }: UserAvatarProps) {
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div
      className={`${sizeMap[size]} flex shrink-0 items-center justify-center rounded-full bg-brand-gold/90 font-semibold text-brand-dark-brown ${className}`}
      title={name}
    >
      {initial}
    </div>
  );
}
