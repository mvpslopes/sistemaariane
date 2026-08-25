import { useEffect, useState } from 'react';
import { getMyModules, type ClientModuleCode } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { HARAS_CLIENT_MODULE_LINKS } from '../constants/clientModules';

export function useClienteHarasLinks() {
  const { hasRole, user } = useAuth();
  const isCliente = hasRole('cliente') && !user?.isAssessor;
  const [codes, setCodes] = useState<Set<ClientModuleCode>>(new Set());

  useEffect(() => {
    if (!isCliente) return;
    getMyModules()
      .then((d) => {
        setCodes(new Set((d.modules || []).filter((m) => m.active).map((m) => m.code as ClientModuleCode)));
      })
      .catch(() => setCodes(new Set()));
  }, [isCliente]);

  if (!isCliente) return [];
  return HARAS_CLIENT_MODULE_LINKS.filter((l) => codes.has(l.code));
}
