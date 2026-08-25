/** Assistente IA — temporariamente desligado. Reative com `VITE_AI_ASSISTANT_ENABLED=true`. */
export const AI_ASSISTANT_ENABLED =
  (import.meta.env.VITE_AI_ASSISTANT_ENABLED as string | undefined)?.toLowerCase() === 'true';
