import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error('A senha deve ter no mínimo 6 caracteres');
    if (password !== confirm) return toast.error('As senhas não conferem');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      const msg = /same|different/i.test(error.message)
        ? 'A nova senha deve ser diferente da atual.'
        : /pwned|leaked|weak/i.test(error.message)
          ? 'Senha muito fraca ou encontrada em vazamentos. Escolha outra.'
          : 'Não foi possível salvar a senha. Peça um novo link.';
      return toast.error(msg);
    }
    toast.success('Senha alterada');
    navigate('/', { replace: true });
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Criar nova senha</h1>
        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Validando o link… Se demorar, abra novamente o link recebido por e-mail ou peça um novo na tela de entrada.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np">Nova senha</Label>
              <Input id="np" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp">Confirmar nova senha</Label>
              <Input id="cp" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            <Button type="submit" disabled={saving} className="w-full">{saving ? 'Salvando...' : 'Salvar nova senha'}</Button>
          </form>
        )}
        <Button variant="link" className="mt-4 p-0" onClick={() => navigate('/auth')}>Voltar para a entrada</Button>
      </div>
    </main>
  );
}
