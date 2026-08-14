import { useEffect, useState } from 'react';
import { mediaUrl } from '../services/apiService';

const sizeMap = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-20 w-20 text-2xl',
} as const;

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
}

export default function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: UserAvatarProps) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [avatarUrl]);

  const src = !broken ? mediaUrl(avatarUrl) : null;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        className={`${sizeMap[size]} shrink-0 rounded-full object-cover ring-1 ring-brand-beige/80 ${className}`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeMap[size]} flex shrink-0 items-center justify-center rounded-full bg-brand-gold/90 font-semibold text-brand-dark-brown ${className}`}
      title={name}
    >
      {initial}
    </div>
  );
}
