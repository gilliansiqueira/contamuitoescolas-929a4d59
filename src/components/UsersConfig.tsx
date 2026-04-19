import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchools } from '@/hooks/useFinancialData';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, UserPlus, Shield, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

interface UserRow {
  user_id: string;
  email: string;
  school_id: string | null;
  role: 'admin' | 'cliente';
  school_nome?: string;
}

export function UsersConfig() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: schools = [] } = useSchools();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolId, setSchoolId] = useState<string>('');
  const [role, setRole] = useState<'admin' | 'cliente'>('cliente');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['app_users'],
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('user_id, email, school_id'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      const schoolMap = new Map(schools.map(s => [s.id, s.nome]));
      return (profiles ?? []).map(p => ({
        user_id: p.user_id,
        email: p.email,
        school_id: p.school_id,
        role: (roles?.find(r => r.user_id === p.user_id)?.role as 'admin' | 'cliente') ?? 'cliente',
        school_nome: p.school_id ? schoolMap.get(p.school_id) : undefined,
      }));
    },
    enabled: isAdmin,
  });

  const createUser = useMutation({
    mutationFn: async () => {
      if (!email.trim() || !password) throw new Error('Preencha email e senha');
      if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');
      if (role === 'cliente' && !schoolId) throw new Error('Selecione uma empresa para o cliente');

      // Cria via signUp (signup público está desabilitado, então fazemos direto pelo admin client não disponível;
      // usamos signUp regular que ainda funciona quando feito por um admin autenticado)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { school_id: role === 'admin' ? null : schoolId },
        },
      });
      if (error) throw new Error(error.message);
      const newUserId = data.user?.id;
      if (!newUserId) throw new Error('Falha ao criar usuário');

      // Atualiza school_id do profile (caso admin sem school)
      await supabase.from('profiles').update({
        school_id: role === 'admin' ? null : schoolId,
      }).eq('user_id', newUserId);

      // Insere role
      const { error: roleErr } = await supabase.from('user_roles').insert({
        user_id: newUserId,
        role,
      });
      if (roleErr) throw new Error(roleErr.message);
    },
    onSuccess: () => {
      toast.success('Usuário criado com sucesso');
      setEmail(''); setPassword(''); setSchoolId(''); setRole('cliente');
      qc.invalidateQueries({ queryKey: ['app_users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      // Apaga profile e role; o usuário em auth.users permanece (admin Cloud pode remover manualmente)
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('user_id', userId);
    },
    onSuccess: () => {
      toast.success('Acesso removido. Lembre-se de excluir o login pelo painel do Cloud se necessário.');
      qc.invalidateQueries({ queryKey: ['app_users'] });
    },
    onError: () => toast.error('Erro ao remover usuário'),
  });

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-display font-bold flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" /> Criar novo usuário
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Senha (mín. 6 caracteres)</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'cliente')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente (vê só sua empresa)</SelectItem>
                <SelectItem value="admin">Admin (vê todas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Empresa {role === 'admin' && <span className="text-xs text-muted-foreground">(opcional)</span>}</Label>
            <Select value={schoolId} onValueChange={setSchoolId} disabled={role === 'admin' && !schoolId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {schools.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={() => createUser.mutate()}
          disabled={createUser.isPending}
          className="gradient-green text-primary-foreground"
        >
          {createUser.isPending ? 'Criando...' : 'Criar usuário'}
        </Button>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-display font-bold mb-4">Usuários cadastrados</h2>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum usuário cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                <div className="flex items-center gap-3">
                  {u.role === 'admin' ? (
                    <Shield className="w-4 h-4 text-secondary" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-primary" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.role === 'admin' ? 'Administrador' : `Cliente · ${u.school_nome ?? 'sem empresa'}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(u.user_id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário não poderá mais acessar o sistema. Para excluir o login completamente,
              remova-o pelo painel do Cloud (Backend &gt; Users).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) deleteUser.mutate(deleteId); setDeleteId(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
