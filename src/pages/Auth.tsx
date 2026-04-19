import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Lock, Mail } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card rounded-2xl p-8 space-y-6"
      >
        <div className="text-center space-y-2">
          <img src={contaMuitoLogo} alt="Conta Muito" className="h-20 w-auto object-contain mx-auto" />
          <h1 className="text-2xl font-display font-bold text-foreground">Relatório Financeiro</h1>
          <p className="text-muted-foreground text-sm">Entre com suas credenciais</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-10"
                autoComplete="email"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-10"
                autoComplete="current-password"
                disabled={submitting}
              />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full gradient-green text-primary-foreground">
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          Não possui acesso? Entre em contato com o administrador.
        </p>
      </motion.div>
    </div>
  );
}
