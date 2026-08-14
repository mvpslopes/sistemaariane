import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Trash2 } from 'lucide-react';
import { mediaUrl, updateProfile, uploadAvatar } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAppMobile } from '../../hooks/useAppMobile';
import UserAvatar from '../../components/UserAvatar';
import PhotoPicker from '../../components/PhotoPicker';
import AppButton from '../../components/AppButton';
import ThemeToggle from '../../components/ThemeToggle';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const appMobile = useAppMobile();
  const { success, error: toastError } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toastError('Selecione uma imagem (JPG, PNG, WEBP ou GIF)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toastError('Imagem muito grande (máx. 5 MB)');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadAvatar(file);
      setAvatarUrl(res.url);
      success('Foto enviada — clique em Salvar perfil para confirmar');
    } catch (err: any) {
      toastError(err.message || 'Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toastError('Informe o nome');
      return;
    }
    setSaving(true);
    try {
      const res = await updateProfile({ name: trimmed, avatarUrl });
      refreshUser(res.user);
      setName(res.user.name);
      setAvatarUrl(res.user.avatarUrl || null);
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
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          {!appMobile && (
            <>
              <h2 className="text-2xl font-semibold text-brand-dark-brown">Meu perfil</h2>
              <p className="text-sm text-brand-olive">Nome e foto de exibição no sistema</p>
            </>
          )}
          {appMobile && (
            <p className="text-sm text-brand-olive">Nome e foto de exibição no sistema</p>
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
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar name={name || user?.name || 'U'} avatarUrl={avatarUrl} size="lg" />
          <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
            <PhotoPicker
              onFile={onPickFile}
              disabled={uploading || saving}
              cameraLabel={uploading ? 'Enviando…' : 'Tirar foto'}
              galleryLabel="Galeria"
              fileLabel={uploading ? 'Enviando…' : 'Escolher foto'}
            />
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                disabled={uploading || saving}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Remover foto
              </button>
            )}
            <p className="text-xs text-brand-olive">JPG, PNG, WEBP ou GIF · máx. 5 MB</p>
            {avatarUrl && mediaUrl(avatarUrl) && (
              <p className="text-xs text-brand-olive/80">Toque em Salvar perfil após trocar a foto.</p>
            )}
          </div>
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
          <AppButton type="submit" loading={saving}>
            Salvar perfil
          </AppButton>
        </div>
      </form>

      <section className="rounded-2xl border border-brand-beige bg-white p-6 shadow-sm">
        <ThemeToggle />
      </section>

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
