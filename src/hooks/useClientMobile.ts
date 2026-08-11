import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from './useIsMobile';

/** Portal mobile dedicado ao perfil cliente (~767px). */
export function useClientMobile() {
  const { hasRole } = useAuth();
  const isMobile = useIsMobile();
  const isCliente = hasRole('cliente');
  return isCliente && isMobile;
}
