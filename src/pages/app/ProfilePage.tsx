import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Trash2 } from 'lucide-react';
import { mediaUrl, updateProfile, uploadAvatar } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import UserAvatar from '../../components/UserAvatar';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { success, error: toastError } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
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
      toastError('Arquivo muito grande (máx. 5 MB)');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadAvatar(file);
      setAvatarUrl(res.url);
      success('Foto enviada. Clique em Salvar para confirmar.');
    } catch (e: any) {
      toastError(e.message || 'Erro ao enviar foto');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
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

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-brand-dark-brown">Meu perfil</h2>
          <p className="text-sm text-brand-olive">Nome e foto de exibição no sistema</p>
        </div>
        <Link to="/app/alterar-senha" className="text-sm text-brand-brown hover:underline">
          Alterar senha
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-brand-beige bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <UserAvatar name={name || user?.name || 'U'} avatarUrl={avatarUrl} size="lg" />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Foto do avatar</p>
            <p className="text-xs text-brand-olive/80">JPG, PNG, WEBP ou GIF · máx. 5 MB</p>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-beige bg-white px-3 py-2 text-xs font-medium text-brand-brown hover:bg-brand-off-white disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
                {uploading ? 'Enviando...' : avatarUrl ? 'Trocar foto' : 'Enviar foto'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              )}
            </div>
            {avatarUrl && mediaUrl(avatarUrl) && (
              <p className="truncate text-[11px] text-brand-olive/50">{avatarUrl}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
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
          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </form>
    </div>
  );
}
