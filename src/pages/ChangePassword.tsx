import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import * as apiService from '../services/apiService';

export default function ChangePassword() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (currentPassword === newPassword) {
      setError('A nova senha deve ser diferente da senha atual');
      return;
    }

    setIsLoading(true);

    try {
      await apiService.changePassword(user?.id || '', currentPassword, newPassword);
      setSuccess(true);
      
      // Fazer logout após 2 segundos para o usuário fazer login novamente
      setTimeout(() => {
        logout();
        navigate('/');
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Erro ao alterar senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige via-brand-off-white to-white">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-soft-lg border-b border-brand-olive/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-brand-beige/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-brand-brown" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-brand-brown">Alterar Senha</h1>
              <p className="text-sm text-brand-olive/70">Bem-vinda, {user?.name}!</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-soft-lg border border-brand-olive/20 p-8">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-brand-brown mb-2">Senha alterada com sucesso!</h2>
              <p className="text-brand-olive/70 mb-4">
                Você será redirecionado para fazer login novamente.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-brand-brown mb-6">Alterar Minha Senha</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Senha Atual */}
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-brand-brown mb-2">
                    Senha Atual
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-olive/50 w-5 h-5" />
                    <input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-3 border border-brand-olive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-olive/50 focus:border-brand-olive bg-white text-brand-brown placeholder:text-brand-olive/40 transition-all"
                      placeholder="Digite sua senha atual"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brand-olive/50 hover:text-brand-olive transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Nova Senha */}
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-brand-brown mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-olive/50 w-5 h-5" />
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-10 py-3 border border-brand-olive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-olive/50 focus:border-brand-olive bg-white text-brand-brown placeholder:text-brand-olive/40 transition-all"
                      placeholder="Digite a nova senha (mínimo 6 caracteres)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brand-olive/50 hover:text-brand-olive transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-brand-olive/60 mt-1">Mínimo de 6 caracteres</p>
                </div>

                {/* Confirmar Nova Senha */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-brand-brown mb-2">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-olive/50 w-5 h-5" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-10 py-3 border border-brand-olive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-olive/50 focus:border-brand-olive bg-white text-brand-brown placeholder:text-brand-olive/40 transition-all"
                      placeholder="Digite a nova senha novamente"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brand-olive/50 hover:text-brand-olive transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Erro */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-brand-brown to-brand-olive text-white rounded-lg font-semibold hover:from-brand-brown/90 hover:to-brand-olive/90 transition-all duration-300 shadow-soft-lg hover:shadow-soft-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Alterando...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Alterar Senha
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

