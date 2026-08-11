import { useEffect, useState } from 'react';

const MOBILE_MQ = '(max-width: 767px)';

export function useIsMobile(breakpoint = MOBILE_MQ) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(breakpoint).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(breakpoint);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}
