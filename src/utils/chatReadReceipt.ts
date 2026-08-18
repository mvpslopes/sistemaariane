import type { ChatMessage } from '../services/apiService';
import { formatTimeHM, parseAppDate } from './dateTime';

export function isMessageReadByPeer(message: ChatMessage, peerLastReadAt: string | null): boolean {
  if (!message.mine || !peerLastReadAt) return false;
  const readAt = parseAppDate(peerLastReadAt);
  const sentAt = parseAppDate(message.createdAt);
  if (!readAt || !sentAt) return false;
  return readAt.getTime() >= sentAt.getTime();
}

/** Última mensagem própria já visualizada pelo contato (estilo WhatsApp). */
export function getLastReadOwnMessageId(
  messages: ChatMessage[],
  peerLastReadAt: string | null
): string | null {
  if (!peerLastReadAt) return null;
  let lastId: string | null = null;
  for (const msg of messages) {
    if (isMessageReadByPeer(msg, peerLastReadAt)) {
      lastId = msg.id;
    }
  }
  return lastId;
}

export function formatReadReceiptLabel(peerLastReadAt: string | null): string {
  if (!peerLastReadAt) return '';
  const time = formatTimeHM(peerLastReadAt);
  return time ? `Visto às ${time}` : '';
}
