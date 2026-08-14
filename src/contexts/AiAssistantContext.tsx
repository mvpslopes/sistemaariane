import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface AiAssistantContextValue {
  open: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
}

const AiAssistantContext = createContext<AiAssistantContextValue | undefined>(undefined);

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openAssistant = useCallback(() => setOpen(true), []);
  const closeAssistant = useCallback(() => setOpen(false), []);
  const toggleAssistant = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openAssistant, closeAssistant, toggleAssistant }),
    [open, openAssistant, closeAssistant, toggleAssistant]
  );

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>;
}

export function useAiAssistant() {
  const ctx = useContext(AiAssistantContext);
  if (!ctx) {
    throw new Error('useAiAssistant must be used within AiAssistantProvider');
  }
  return ctx;
}
