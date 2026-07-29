import { useState } from 'react';
import { Link } from 'react-router-dom';
import { changePassword } from '../services/apiService';
import { useToast } from '../contexts/ToastContext';

export default function ChangePassword() {
  const { success, error: toastError } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toastError('A confirmação não confere com a nova senha.');
      return;
    }
    if (newPassword.length < 6) {
      toastError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      success(res.message || 'Senha alterada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toastError(err.message || 'Erro ao alterar senha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-brand-dark-brown">Alterar senha</h2>
          <p className="text-sm text-brand-olive">Atualize sua senha de acesso</p>
        </div>
        <Link to="/app/perfil" className="text-sm text-brand-brown hover:underline">
          Voltar ao perfil
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-brand-beige bg-white p-6 shadow-sm">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Senha atual</span>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Nova senha</span>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Confirmar nova senha</span>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar senha'}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige';
