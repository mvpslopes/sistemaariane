import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export function useAnimatedPresence(open: boolean, duration = 280) {
  const reducedMotion = useReducedMotion();
  const effectiveDuration = reducedMotion ? 0 : duration;
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (effectiveDuration === 0) {
        setVisible(true);
        return;
      }
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    if (effectiveDuration === 0) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), effectiveDuration);
    return () => window.clearTimeout(timer);
  }, [open, effectiveDuration]);

  return { mounted, visible, duration: effectiveDuration };
}
