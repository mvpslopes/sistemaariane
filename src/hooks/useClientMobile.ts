import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from './useIsMobile';

/** UI específica do perfil cliente no mobile (rótulos, filtros etc.). */
export function useClientMobile() {
  const { hasRole } = useAuth();
  const isMobile = useIsMobile();
  const isCliente = hasRole('cliente');
  return isCliente && isMobile;
}
