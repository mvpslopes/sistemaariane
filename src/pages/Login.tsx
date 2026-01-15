import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Lock, Mail, X } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);
      
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Email ou senha incorretos. Tente novamente.');
        setIsLoading(false);
      }
    } catch (error) {
      setError('Erro ao fazer login. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige via-brand-off-white to-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Efeitos de fundo animados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-brown/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-olive/5 rounded-full blur-3xl animate-float-delayed"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft-xl p-8 md:p-10 border border-brand-olive/20 animate-scale-in hover:shadow-soft-xl transition-shadow duration-300">
          {/* Logo e Título */}
          <div className="text-center mb-8 animate-slide-up">
            <div className="mb-6 animate-fade-in">
              <img
                src="/logo-ariane-wide.png"
                alt="Logo Ariane"
                className="h-20 md:h-24 mx-auto object-contain drop-shadow-lg"
                onError={(e) => {
                  // Fallback se a logo não existir
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-brand-brown mb-2 bg-gradient-to-r from-brand-brown to-brand-olive bg-clip-text text-transparent">
              Sistema Interno
            </h1>
            <p className="text-brand-olive/70 text-sm md:text-base">
              Registro Diário de Atendimento
            </p>
            <div className="mt-4 w-24 h-1 bg-gradient-to-r from-brand-brown to-brand-olive mx-auto rounded-full animate-expand"></div>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brand-brown mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-olive/50 w-5 h-5" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-brand-olive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-olive/50 focus:border-brand-olive bg-white text-brand-brown placeholder:text-brand-olive/40 transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-brown mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-olive/50 w-5 h-5" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-brand-olive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-olive/50 focus:border-brand-olive bg-white text-brand-brown placeholder:text-brand-olive/40 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* Botões */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                disabled={isLoading}
                className="w-full sm:w-auto px-6 py-3 border-2 border-brand-olive/40 text-brand-brown rounded-lg font-semibold hover:bg-brand-olive/10 hover:border-brand-olive transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <X className="w-5 h-5" />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:flex-1 bg-gradient-to-r from-brand-brown to-brand-olive text-white py-3 rounded-lg font-semibold hover:from-brand-brown/90 hover:to-brand-olive transition-all duration-300 shadow-soft-lg hover:shadow-soft-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="animate-pulse">Entrando...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    Entrar
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Rodapé */}
          <div className="mt-8 pt-6 border-t border-brand-olive/20 text-center">
            <p className="text-xs text-brand-olive/60">
              Acesso restrito a colaboradores autorizados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

