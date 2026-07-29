import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LogIn, Lock, User, PawPrint, ShieldCheck, Users } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const { error: toastError, success } = useToast();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(username.trim(), password);
      if (result.ok) {
        success('Login realizado com sucesso');
        navigate('/app');
      } else {
        toastError(result.error || 'Usuário ou senha incorretos. Tente novamente.');
        setIsLoading(false);
      }
    } catch {
      toastError('Erro ao fazer login. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-brand-off-white">
      {/* Painel decorativo — visível em telas grandes */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-brand-dark-brown via-[#3d2f26] to-brand-brown lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-brand-gold/10 blur-3xl animate-float" />
          <div className="absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-brand-forest/10 blur-3xl animate-float-delayed" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
        </div>

        <div className="relative z-10">
          <img
            src="/logo-ariane-wide_branco.png"
            alt="Ariane Andrade Assessoria"
            className="h-16 w-auto max-w-[320px] object-contain object-left drop-shadow-lg md:h-20"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Gestão completa do seu plantel, em um só lugar.
          </h2>
          <p className="mt-4 text-sm text-brand-beige/60">
            Cadastro de clientes, animais e genealogia com segurança e organização — pensado para
            haras e assessorias equestres.
          </p>

          <div className="mt-8 space-y-4">
            <Feature icon={PawPrint} text="Ficha completa dos animais, com foto e genealogia" />
            <Feature icon={Users} text="Clientes e proprietários organizados por haras" />
            <Feature icon={ShieldCheck} text="Acesso por perfil: root, admin, usuário e cliente" />
          </div>
        </div>

        <p className="relative z-10 text-xs text-brand-beige/30">
          © {new Date().getFullYear()} Ariane Andrade Assessoria
        </p>
      </div>

      {/* Formulário */}
      <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden p-4 lg:w-1/2">
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-brand-brown/10 blur-3xl" />
          <div className="absolute -right-10 bottom-10 h-96 w-96 rounded-full bg-brand-olive/10 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-2xl border border-brand-olive/20 bg-white/90 p-8 shadow-soft-xl backdrop-blur-sm md:p-10">
            <div className="mb-8 text-center">
              <img
                src="/logo-ariane-wide.png"
                alt="Logo Ariane"
                className="mx-auto mb-6 h-16 object-contain md:h-20 lg:hidden"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <h1 className="bg-gradient-to-r from-brand-brown to-brand-olive bg-clip-text text-3xl font-bold text-transparent">
                Bem-vindo de volta
              </h1>
              <p className="mt-2 text-sm text-brand-olive/70">Entre para acessar seu painel</p>
              <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-brand-brown to-brand-olive" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-brand-brown">
                  Usuário
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-olive/50" />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full rounded-xl border border-brand-olive/20 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
                    placeholder="marcus.lopes"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-brand-brown">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-olive/50" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-brand-olive/20 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-brown py-3 text-sm font-semibold text-white shadow-lg shadow-brand-brown/25 transition hover:bg-brand-olive disabled:opacity-60"
              >
                <LogIn className="h-5 w-5" />
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-brand-olive/50">
              <a
                href="https://arianeandradeassessoria.app.br/"
                className="hover:text-brand-brown"
                target="_blank"
                rel="noreferrer"
              >
                Site institucional
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof PawPrint; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-gold-light">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm text-brand-beige/80">{text}</p>
    </div>
  );
}
