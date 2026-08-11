import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import { updateProfile } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAppMobile } from '../../hooks/useAppMobile';
import UserAvatar from '../../components/UserAvatar';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const appMobile = useAppMobile();
  const { success, error: toastError } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toastError('Informe o nome');
      return;
    }
    setSaving(true);
    try {
      const res = await updateProfile({ name: trimmed });
      refreshUser(res.user);
      setName(res.user.name);
      success('Perfil atualizado');
    } catch (err: any) {
      toastError(err.message || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          {!appMobile && (
            <>
              <h2 className="text-2xl font-semibold text-brand-dark-brown">Meu perfil</h2>
              <p className="text-sm text-brand-olive">Nome de exibição no sistema</p>
            </>
          )}
          {appMobile && (
            <p className="text-sm text-brand-olive">Nome de exibição no sistema</p>
          )}
        </div>
        <Link
          to="/app/alterar-senha"
          className="inline-flex items-center gap-1.5 text-sm text-brand-brown hover:underline"
        >
          <KeyRound className="h-4 w-4" />
          Alterar senha
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-brand-beige bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <UserAvatar name={name || user?.name || 'U'} size="lg" />
          <p className="text-sm text-brand-olive">Inicial gerada a partir do nome</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Nome *</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            placeholder="Seu nome"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Usuário</span>
          <input
            disabled
            value={user?.username || ''}
            className="w-full rounded-xl border border-brand-beige bg-brand-off-white px-3 py-2.5 text-sm text-brand-olive"
          />
        </label>

        <div className="flex gap-2 border-t border-brand-beige pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </form>

      {appMobile && (
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-600 shadow-card transition hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      )}
    </div>
  );
}
