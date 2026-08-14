import assistantIcon from '../../public/icon-agent-ia.png?url';

const sizeMap = {
  xs: 'h-4 w-4',
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  fab: 'h-full w-full',
} as const;

type AssistantMarkSize = keyof typeof sizeMap;

interface AssistantMarkProps {
  size?: AssistantMarkSize;
  className?: string;
}

/** Ícone do Assistente IA — usado no FAB, sidebar e painel de chat. */
export default function AssistantMark({ size = 'md', className = '' }: AssistantMarkProps) {
  return (
    <img
      src={assistantIcon}
      alt=""
      aria-hidden
      className={`object-contain ${sizeMap[size]} ${className}`}
    />
  );
}
