import { useAiAssistant } from '../contexts/AiAssistantContext';
import { NavIconWrap } from './SidebarNav';
import AssistantMark from './AssistantMark';

export default function AssistantSidebarButton({ compact = false }: { compact?: boolean }) {
  const { openAssistant } = useAiAssistant();

  return (
    <button
      type="button"
      onClick={openAssistant}
      className={`group relative flex w-full items-center gap-2.5 rounded-xl py-2 text-sm font-medium text-brand-beige/65 transition-all duration-200 hover:bg-white/5 hover:text-white ${
        compact ? 'justify-center px-2' : 'px-2.5 pl-3'
      }`}
      title="Assistente Ariane"
    >
      {!compact && (
        <span className="ml-2 h-1 w-1 shrink-0 rounded-full bg-brand-beige/25" aria-hidden />
      )}
      <NavIconWrap size="sm">
        <AssistantMark size="xs" />
      </NavIconWrap>
      {!compact && <span>Assistente IA</span>}
    </button>
  );
}
