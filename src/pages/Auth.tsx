import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, BarChart3, CreditCard, Eye, EyeOff, Lock, Mail, CircleDollarSign } from 'lucide-react';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';

const DEMO_INDICATORS = [
  { label: 'Receitas', value: 'R$ 48.500', variation: '+12%', icon: BarChart3, tone: 'positive' },
  { label: 'Despesas', value: 'R$ 32.200', variation: '-8%', icon: CreditCard, tone: 'expense' },
  { label: 'Resultado', value: 'R$ 16.300', variation: '+28%', icon: CircleDollarSign, tone: 'positive' },
] as const;

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reduceMotion = useReducedMotion();

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
    <main className="auth-report relative min-h-screen overflow-hidden bg-background">
      <div className="auth-orb auth-orb-top" aria-hidden="true" />
      <div className="auth-orb auth-orb-bottom" aria-hidden="true" />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1440px] items-center gap-10 px-6 py-8 sm:px-10 lg:grid-cols-[1.3fr_0.82fr] lg:gap-16 lg:px-16 xl:px-20">
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <motion.img
            src={contaMuitoLogo}
            alt="Conta Muito"
            initial={reduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="auth-main-logo h-auto w-60 object-contain sm:w-72 lg:w-64"
          />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="mt-5 max-w-2xl lg:mt-7"
          >
            <h1 className="text-4xl font-bold leading-[1.06] text-foreground sm:text-5xl lg:text-6xl">
              Seu financeiro tem<br className="hidden sm:block" /> <span className="text-primary">muito a contar.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              Uma nova forma personalizada de enxergar os números da sua empresa.
            </p>
          </motion.div>

          <div className="mt-8 hidden w-full max-w-3xl lg:block">
            <div className="grid grid-cols-3 rounded-md border border-border bg-card/75 px-5 py-4 shadow-sm">
              {DEMO_INDICATORS.map((indicator, index) => {
                const Icon = indicator.icon;
                return (
                  <motion.div
                    key={indicator.label}
                    initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, delay: 0.35 + index * 0.14 }}
                    className={`px-4 ${index > 0 ? 'border-l border-border' : ''}`}
                  >
                    <motion.div
                      animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
                      transition={{ duration: 2.6, delay: 0.8 + index * 0.25, repeat: Infinity, repeatDelay: 1.2 }}
                      className={`mb-2 flex h-10 w-10 items-center justify-center rounded-md ${indicator.tone === 'expense' ? 'bg-primary/10 text-primary' : 'bg-secondary/15 text-secondary'}`}
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                    <p className="text-sm font-semibold text-muted-foreground">{indicator.label}</p>
                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.65 + index * 0.14 }}
                      className="mt-0.5 text-xl font-bold text-foreground"
                    >
                      {indicator.value}
                    </motion.p>
                    <p className="mt-0.5 text-sm font-bold text-secondary">↗ {indicator.variation}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">em relação ao período anterior</p>
                  </motion.div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Dados ilustrativos</p>
          </div>

          <Button variant="link" className="mt-6 hidden h-auto p-0 font-semibold text-secondary lg:inline-flex" onClick={() => navigate('/demo')}>
            Conheça por dentro <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>

        <section className="flex w-full items-center justify-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-md rounded-lg border border-border bg-card/90 p-6 shadow-sm sm:p-9"
          >
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">Bem-vindo de volta.</h2>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-md bg-background/70 pl-11" autoComplete="email" disabled={submitting} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-semibold">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-md bg-background/70 px-11" autoComplete="current-password" disabled={submitting} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="h-12 w-full rounded-md text-sm font-bold shadow-sm">
                {submitting ? 'Entrando...' : 'Acessar meus relatórios'}
              </Button>
            </form>

            <div className="mt-7 border-t border-border pt-5 text-center">
              <span className="text-xs text-muted-foreground">Não possui acesso? Fale com o administrador.</span>
            </div>
          </motion.div>
        </section>

        <Button variant="link" className="mx-auto h-auto p-0 font-semibold text-secondary lg:hidden" onClick={() => navigate('/demo')}>
          Conheça por dentro <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}
