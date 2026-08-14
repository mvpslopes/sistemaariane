import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getContract, type Contract } from '../../services/apiService';
import Loading from '../../components/Loading';
import ContractDocument from './ContractDocument';

/** Rota direta (compatibilidade). Preferir modal em Contratos. */
export default function ContractPrintView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getContract(id)
      .then(setContract)
      .catch((e) => setError(e.message || 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading fullScreen message="Preparando contrato..." />;
  if (error || !contract) {
    return <div className="p-8 text-center text-red-600">{error || 'Contrato não encontrado'}</div>;
  }

  return (
    <div className="theme-fixed min-h-screen bg-brand-off-white p-4 md:p-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-brand-beige bg-white p-6 shadow-card md:p-8">
        <ContractDocument
          contract={contract}
          showActions
          onClose={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/app/contratos');
          }}
        />
      </div>
    </div>
  );
}
