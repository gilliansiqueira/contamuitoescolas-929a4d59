import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, BarChart3, Lock, Mail } from 'lucide-react';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate('/', { replace: true });
  }, [session, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Preencha email e senha');
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      toast.error('Email ou senha incorretos');
    } else {
      toast.success('Login realizado');
      navigate('/', { replace: true });
    }
  };

  return (
    <main className="auth-report min-h-screen bg-background p-3 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] overflow-hidden rounded-lg border border-border/70 bg-card shadow-xl sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="auth-report-visual relative hidden overflow-hidden bg-foreground px-10 py-10 text-background lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14">
          <div className="relative z-10">
            <img src={contaMuitoLogo} alt="Conta Muito" className="h-16 w-auto object-contain brightness-0 invert" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 max-w-2xl"
          >
            <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-secondary">
              <BarChart3 className="h-4 w-4" /> Gestão financeira
            </p>
            <h1 className="font-editorial text-5xl leading-[1.02] text-background xl:text-7xl">
              Decisões claras.<br />Resultados fortes.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-background/65 xl:text-lg">
              Projeções, realizado e indicadores em uma única visão confiável.
            </p>
          </motion.div>

          <div className="relative z-10 h-48" aria-hidden="true">
            <div className="auth-bars absolute bottom-0 left-0 flex h-40 items-end gap-3">
              {[38, 62, 51, 78, 94].map((height, index) => (
                <motion.span
                  key={height}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.8, delay: 0.12 * index }}
                  className={index > 2 ? 'bg-primary' : 'bg-secondary'}
                />
              ))}
            </div>
            <svg className="absolute bottom-1 right-0 h-44 w-[62%]" viewBox="0 0 420 170" fill="none" role="presentation">
              <path className="auth-chart-grid" d="M0 30H420M0 78H420M0 126H420" />
              <motion.path
                d="M4 145 L68 124 L130 130 L194 91 L255 101 L320 48 L416 21"
                className="auth-chart-line"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 0.35 }}
              />
            </svg>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-md"
          >
            <img src={contaMuitoLogo} alt="Conta Muito" className="mb-12 h-16 w-auto object-contain lg:hidden" />
            <div className="mb-9 border-l-4 border-primary pl-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Área do cliente</p>
              <h2 className="font-editorial text-4xl text-foreground sm:text-5xl">Acesse sua conta</h2>
              <p className="mt-2 text-sm text-muted-foreground">Entre com suas credenciais para continuar.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-md bg-background pl-11" autoComplete="email" disabled={submitting} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-md bg-background pl-11" autoComplete="current-password" disabled={submitting} />
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="h-12 w-full rounded-md text-sm font-bold">
                {submitting ? 'Entrando...' : 'Entrar'}
                {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <span>Não possui acesso? Fale com o administrador.</span>
              <Button variant="link" className="h-auto p-0 text-secondary" onClick={() => navigate('/demo')}>Ver demonstração</Button>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
