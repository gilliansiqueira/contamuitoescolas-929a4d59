import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchools } from '@/hooks/useFinancialData';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, UserPlus, Shield, User as UserIcon, Building2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface UserRow {
  user_id: string;
  email: string;
  school_id: string | null;
  role: 'admin' | 'cliente';
  school_nome?: string;
  extra_school_ids: string[];
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [extraToAdd, setExtraToAdd] = useState<Record<string, string>>({});

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['app_users'],
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: profiles }, { data: roles }, { data: extras }] = await Promise.all([
        supabase.from('profiles').select('user_id, email, school_id'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('user_schools').select('user_id, school_id'),
      ]);
      const schoolMap = new Map(schools.map(s => [s.id, s.nome]));
      return (profiles ?? []).map(p => ({
        user_id: p.user_id,
        email: p.email,
        school_id: p.school_id,
        role: (roles?.find(r => r.user_id === p.user_id)?.role as 'admin' | 'cliente') ?? 'cliente',
        school_nome: p.school_id ? schoolMap.get(p.school_id) : undefined,
        extra_school_ids: (extras ?? [])
          .filter((e: any) => e.user_id === p.user_id)
          .map((e: any) => e.school_id),
      }));
    },
    enabled: isAdmin,
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) throw new Error('Preencha email e senha');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Email inválido. Use formato com domínio (ex: usuario@empresa.com)');
      }
      if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');
      if (role === 'cliente' && !schoolId) throw new Error('Selecione uma empresa principal para o cliente');

      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: cleanEmail,
          password,
          role,
          school_id: role === 'cliente' ? schoolId : null,
        },
      });
      if (error) throw new Error(error.message ?? 'Erro ao criar usuário');
      if (data?.error) throw new Error(data.error);
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
      await supabase.from('user_schools').delete().eq('user_id', userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('user_id', userId);
    },
    onSuccess: () => {
      toast.success('Acesso removido. Lembre-se de excluir o login pelo painel do Cloud se necessário.');
      qc.invalidateQueries({ queryKey: ['app_users'] });
    },
    onError: () => toast.error('Erro ao remover usuário'),
  });

  const addExtraSchool = useMutation({
    mutationFn: async ({ userId, schoolIdToAdd }: { userId: string; schoolIdToAdd: string }) => {
      const { error } = await supabase.from('user_schools').insert({ user_id: userId, school_id: schoolIdToAdd });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success('Empresa adicional vinculada');
      setExtraToAdd(prev => ({ ...prev, [vars.userId]: '' }));
      qc.invalidateQueries({ queryKey: ['app_users'] });
    },
    onError: (e: any) => toast.error(e.message?.includes('duplicate') ? 'Empresa já vinculada' : 'Erro ao vincular empresa'),
  });

  const removeExtraSchool = useMutation({
    mutationFn: async ({ userId, schoolIdToRemove }: { userId: string; schoolIdToRemove: string }) => {
      const { error } = await supabase
        .from('user_schools')
        .delete()
        .eq('user_id', userId)
        .eq('school_id', schoolIdToRemove);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Empresa desvinculada');
      qc.invalidateQueries({ queryKey: ['app_users'] });
    },
    onError: () => toast.error('Erro ao desvincular empresa'),
  });

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  const schoolNameById = (id: string) => schools.find(s => s.id === id)?.nome ?? '—';

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
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="admin">Admin (vê todas as empresas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              Empresa principal {role === 'admin' && <span className="text-xs text-muted-foreground">(opcional)</span>}
            </Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {schools.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Após criar, você pode vincular <strong>empresas adicionais</strong> ao usuário expandindo o card dele abaixo.
        </p>
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
            {users.map(u => {
              const expanded = expandedUserId === u.user_id;
              const availableExtras = schools.filter(
                s => s.id !== u.school_id && !u.extra_school_ids.includes(s.id)
              );
              return (
                <div key={u.user_id} className="rounded-lg bg-surface border border-border overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {u.role === 'admin' ? (
                        <Shield className="w-4 h-4 text-secondary" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-primary" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{u.email}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          {u.role === 'admin' ? 'Administrador' : 'Cliente'}
                          {u.school_nome && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              <Building2 className="w-2.5 h-2.5 mr-0.5" />
                              {u.school_nome}
                            </Badge>
                          )}
                          {u.extra_school_ids.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] py-0 h-4">
                              +{u.extra_school_ids.length} extra{u.extra_school_ids.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExpandedUserId(expanded ? null : u.user_id)}
                        title={expanded ? 'Recolher' : 'Gerenciar empresas'}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(u.user_id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-border p-3 space-y-3 bg-background/50">
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                          Empresas vinculadas
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {u.school_id && (
                            <Badge variant="default" className="gap-1">
                              <Building2 className="w-3 h-3" />
                              {schoolNameById(u.school_id)}
                              <span className="text-[9px] opacity-70 ml-1">principal</span>
                            </Badge>
                          )}
                          {u.extra_school_ids.map(sid => (
                            <Badge key={sid} variant="secondary" className="gap-1 pr-1">
                              <Building2 className="w-3 h-3" />
                              {schoolNameById(sid)}
                              <button
                                onClick={() => removeExtraSchool.mutate({ userId: u.user_id, schoolIdToRemove: sid })}
                                className="ml-1 hover:bg-destructive/20 rounded-sm p-0.5"
                                title="Remover acesso"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                          {!u.school_id && u.extra_school_ids.length === 0 && (
                            <span className="text-xs text-muted-foreground">Nenhuma empresa vinculada.</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                          Adicionar empresa
                        </Label>
                        <div className="flex gap-2">
                          <Select
                            value={extraToAdd[u.user_id] ?? ''}
                            onValueChange={(v) => setExtraToAdd(prev => ({ ...prev, [u.user_id]: v }))}
                            disabled={availableExtras.length === 0}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder={availableExtras.length === 0 ? 'Sem empresas para adicionar' : 'Selecione...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableExtras.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            disabled={!extraToAdd[u.user_id] || addExtraSchool.isPending}
                            onClick={() => addExtraSchool.mutate({
                              userId: u.user_id,
                              schoolIdToAdd: extraToAdd[u.user_id],
                            })}
                            className="gradient-green text-primary-foreground"
                          >
                            <Plus className="w-4 h-4 mr-1" /> Vincular
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
