import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, Copy, Eye, EyeOff, ExternalLink, History, Pencil, Plus, RotateCcw, Search, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolFeature } from '@/hooks/useBankPilot';

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any };

export const ACCESS_GROUPS: { key: string; label: string }[] = [
  { key: 'email', label: 'E-mail da empresa' },
  { key: 'sistemas', label: 'Sistemas escolares' },
  { key: 'bancos', label: 'Bancos e maquininhas' },
  { key: 'beneficios', label: 'Benefícios' },
  { key: 'consumo', label: 'Contas de consumo' },
  { key: 'outros', label: 'Seguros e outros' },
  { key: 'pix', label: 'Chaves PIX de pagamento' },
];
const groupLabel = (k: string) => ACCESS_GROUPS.find(g => g.key === k)?.label ?? 'Seguros e outros';

interface Extra { label: string; value: string }
interface Entry { id: string; grupo: string; servico: string; url: string | null; login: string | null; extras: Extra[]; observacao: string | null; archived_at: string | null; updated_at: string }
interface Hist { id: string; acao: string; servico: string | null; login: string | null; url: string | null; changed_by: string | null; changed_at: string }

const copy = async (t: string, what = 'Copiado') => { await navigator.clipboard.writeText(t); toast.success(what); };
const fmtDT = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function SecretField({ id }: { id: string }) {
  const [val, setVal] = useState<string | null>(null);
  const reveal = async (acao: 'ver' | 'copiar') => {
    const { data, error } = await db.rpc('reveal_access_secret', { _id: id, _acao: acao });
    if (error) { toast.error('Não foi possível abrir a senha.'); return null; }
    return (data as string | null) ?? '';
  };
  return (
    <div className="flex items-start gap-1">
      <span className="text-xs text-muted-foreground w-14 shrink-0 pt-1">Senha</span>
      <span className="font-mono text-sm flex-1 whitespace-pre-wrap break-all pt-0.5">{val ?? '••••••••'}</span>
      <Button size="icon" variant="ghost" className="h-7 w-7" title={val ? 'Esconder' : 'Mostrar'}
        onClick={async () => { if (val != null) return setVal(null); const v = await reveal('ver'); if (v != null) setVal(v || '(sem senha)'); }}>
        {val ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Copiar senha"
        onClick={async () => { const v = await reveal('copiar'); if (v) copy(v.split('\n')[0], 'Senha copiada'); else if (v === '') toast('Sem senha cadastrada'); }}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-1">
      <span className="text-xs text-muted-foreground w-14 shrink-0 pt-1 truncate" title={label}>{label}</span>
      <span className={`text-sm flex-1 break-all pt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</span>
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Copiar" onClick={() => copy(value)}><Copy className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

const empty = { id: null as string | null, grupo: 'outros', servico: '', url: '', login: '', senha: '', changeSenha: false, extras: [] as Extra[], observacao: '' };

export function ClientAccess({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const qc = useQueryClient();
  const { data: enabled, isLoading: featLoading } = useSchoolFeature(schoolId, 'acessos_senhas');
  const [busca, setBusca] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [hist, setHist] = useState<Entry | null>(null);
  const key = ['client-access', schoolId];

  const q = useQuery({
    queryKey: key, enabled: !!enabled,
    queryFn: async () => {
      const { data, error } = await db.from('client_access_entries')
        .select('id,grupo,servico,url,login,extras,observacao,archived_at,updated_at').eq('school_id', schoolId).order('ordem').order('servico');
      if (error) throw error;
      return data as Entry[];
    },
  });
  const histQ = useQuery({
    queryKey: ['client-access-hist', hist?.id], enabled: !!hist,
    queryFn: async () => {
      const { data, error } = await db.from('client_access_history').select('id,acao,servico,login,url,changed_by,changed_at').eq('entry_id', hist!.id).order('changed_at', { ascending: false });
      if (error) throw error;
      const { data: names } = await db.rpc('get_management_responsible_display_names', {});
      const nm = new Map(((names ?? []) as { user_id: string; display_name: string }[]).map(n => [n.user_id, n.display_name]));
      return (data as Hist[]).map(h => ({ ...h, quem: (h.changed_by && nm.get(h.changed_by)) || 'Equipe' }));
    },
  });
  const viewsQ = useQuery({
    queryKey: ['client-access-views', hist?.id], enabled: !!hist,
    queryFn: async () => {
      const { data } = await db.from('client_access_views').select('id,acao,user_id,viewed_at').eq('entry_id', hist!.id).order('viewed_at', { ascending: false }).limit(30);
      return (data ?? []) as { id: string; acao: string; user_id: string; viewed_at: string }[];
    },
  });

  const activate = async () => {
    const { error } = await db.from('school_features').upsert({ school_id: schoolId, feature_key: 'acessos_senhas', enabled: true }, { onConflict: 'school_id,feature_key' });
    if (error) return toast.error('Não foi possível ativar.');
    qc.invalidateQueries({ queryKey: ['schoolFeature', schoolId, 'acessos_senhas'] });
  };

  const list = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (q.data ?? []).filter(e => (showArchived ? !!e.archived_at : !e.archived_at))
      .filter(e => !t || [e.servico, e.login, e.url, e.observacao, ...(e.extras ?? []).map(x => `${x.label} ${x.value}`)].join(' ').toLowerCase().includes(t));
  }, [q.data, busca, showArchived]);

  const save = async () => {
    if (!form) return;
    const { error } = await db.rpc('save_access_entry', {
      _id: form.id, _school_id: schoolId, _grupo: form.grupo, _servico: form.servico, _url: form.url || null, _login: form.login || null,
      _senha: form.senha, _change_senha: form.id ? form.changeSenha : true,
      _extras: form.extras.filter(x => x.label.trim() || x.value.trim()), _observacao: form.observacao || null,
    });
    if (error) return toast.error(error.message.includes('serviço') ? 'Informe o nome do serviço.' : 'Não foi possível salvar.');
    toast.success('Acesso salvo. A versão anterior ficou no histórico.');
    setConfirm(false); setForm(null); qc.invalidateQueries({ queryKey: key });
  };
  const archive = async (e: Entry, a: boolean) => {
    const { error } = await db.rpc('archive_access_entry', { _id: e.id, _archive: a });
    if (error) return toast.error('Não foi possível.');
    toast.success(a ? 'Arquivado (pode ser restaurado em "Arquivados").' : 'Acesso restaurado.');
    qc.invalidateQueries({ queryKey: key });
  };
  const restore = async (h: Hist) => {
    const { error } = await db.rpc('restore_access_version', { _hist_id: h.id });
    if (error) return toast.error('Não foi possível restaurar.');
    toast.success('Versão restaurada.');
    qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['client-access-hist', hist?.id] });
  };

  if (featLoading) return null;
  if (!enabled) return (
    <div className="rounded-lg border bg-card p-8 text-center space-y-3">
      <KeyRound className="h-8 w-8 mx-auto text-primary" />
      <h2 className="text-lg font-semibold">Acessos e senhas</h2>
      <p className="text-sm text-muted-foreground">Guarde logins, senhas e chaves PIX desta empresa em um só lugar, com histórico de alterações.</p>
      <Button onClick={activate}>Ativar nesta empresa</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Acessos e senhas</h2>
          <p className="text-sm text-muted-foreground">{schoolName} · senhas guardadas com criptografia; cada visualização fica registrada.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative"><Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8 w-56" placeholder="Buscar serviço ou login" value={busca} onChange={e => setBusca(e.target.value)} /></div>
          <Button variant={showArchived ? 'secondary' : 'outline'} onClick={() => setShowArchived(s => !s)}><Archive className="h-4 w-4 mr-1" />{showArchived ? 'Ver ativos' : 'Arquivados'}</Button>
          <Button onClick={() => setForm({ ...empty })}><Plus className="h-4 w-4 mr-1" />Novo acesso</Button>
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!q.isLoading && list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum acesso {showArchived ? 'arquivado' : 'cadastrado'}.</p>}

      {ACCESS_GROUPS.map(g => {
        const items = list.filter(e => (ACCESS_GROUPS.some(x => x.key === e.grupo) ? e.grupo : 'outros') === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.label} <span className="font-normal">({items.length})</span></h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map(e => (
                <div key={e.id} className="rounded-lg border bg-card p-3 space-y-1 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold flex-1 truncate">{e.servico}</span>
                    {e.url && <Button size="sm" variant="outline" className="h-7" asChild><a href={/^https?:/i.test(e.url) ? e.url : `https://${e.url}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir</a></Button>}
                  </div>
                  {e.login && <Row label={g.key === 'pix' ? 'Chave' : 'Login'} value={e.login} mono />}
                  {g.key !== 'pix' && <SecretField id={e.id} />}
                  {(e.extras ?? []).map((x, i) => <Row key={i} label={x.label} value={x.value} />)}
                  {e.observacao && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{e.observacao}</p>}
                  <div className="flex items-center gap-1 pt-1 border-t mt-2">
                    <span className="text-[11px] text-muted-foreground flex-1">Alterado em {fmtDT(e.updated_at)}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Histórico" onClick={() => setHist(e)}><History className="h-3.5 w-3.5" /></Button>
                    {e.archived_at
                      ? <Button size="icon" variant="ghost" className="h-7 w-7" title="Restaurar" onClick={() => archive(e, false)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                      : <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => setForm({ id: e.id, grupo: e.grupo, servico: e.servico, url: e.url ?? '', login: e.login ?? '', senha: '', changeSenha: false, extras: e.extras ?? [], observacao: e.observacao ?? '' })}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Arquivar" onClick={() => { if (window.confirm(`Arquivar "${e.servico}"? Ele continua guardado em Arquivados.`)) archive(e, true); }}><Archive className="h-3.5 w-3.5" /></Button>
                        </>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <Dialog open={!!form} onOpenChange={o => { if (!o) { setForm(null); setConfirm(false); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? 'Editar acesso' : 'Novo acesso'}</DialogTitle>
            <DialogDescription>Ao salvar, a versão anterior fica guardada no histórico.</DialogDescription></DialogHeader>
          {form && (
            <div className="space-y-3">
              <Select value={form.grupo} onValueChange={v => setForm({ ...form, grupo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACCESS_GROUPS.map(g => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder={form.grupo === 'pix' ? 'Nome (ex.: PIX Camila – panfletagem)' : 'Serviço (ex.: Banco Inter)'} value={form.servico} onChange={e => setForm({ ...form, servico: e.target.value })} />
              {form.grupo !== 'pix' && <Input placeholder="Link (https://…)" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />}
              <Input placeholder={form.grupo === 'pix' ? 'Chave PIX' : 'Login / e-mail'} value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} />
              {form.grupo !== 'pix' && (form.id && !form.changeSenha
                ? <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, changeSenha: true })}>Trocar senha</Button>
                : <Textarea rows={2} placeholder={form.id ? 'Nova senha (em branco = sem senha)' : 'Senha'} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} className="font-mono" />)}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Campos extras (código do operador, matrícula, celular do token…)</p>
                {form.extras.map((x, i) => (
                  <div key={i} className="flex gap-2">
                    <Input className="w-40" placeholder="Nome" value={x.label} onChange={e => { const ex = [...form.extras]; ex[i] = { ...x, label: e.target.value }; setForm({ ...form, extras: ex }); }} />
                    <Input placeholder="Valor" value={x.value} onChange={e => { const ex = [...form.extras]; ex[i] = { ...x, value: e.target.value }; setForm({ ...form, extras: ex }); }} />
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, extras: [...form.extras, { label: '', value: '' }] })}><Plus className="h-3.5 w-3.5 mr-1" />Campo</Button>
              </div>
              <Textarea rows={2} placeholder="Observação" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
            </div>
          )}
          <DialogFooter>
            {confirm
              ? <><span className="text-sm mr-auto">Confirmar alteração?</span><Button variant="outline" onClick={() => setConfirm(false)}>Voltar</Button><Button onClick={save}>Confirmar</Button></>
              : <><Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={() => (form?.id ? setConfirm(true) : save())}>Salvar</Button></>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hist} onOpenChange={o => !o && setHist(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico · {hist?.servico}</DialogTitle><DialogDescription>Versões anteriores e quem viu ou copiou a senha.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {(histQ.data ?? []).map(h => (
              <div key={h.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                <div className="flex-1">
                  <div><Badge variant="outline" className="mr-2">{h.acao}</Badge>{fmtDT(h.changed_at)} · {h.quem}</div>
                  {h.login && <div className="text-xs text-muted-foreground">Login anterior: {h.login}</div>}
                </div>
                {['editado', 'senha alterada', 'restaurado'].includes(h.acao) && !hist?.archived_at &&
                  <Button size="sm" variant="outline" onClick={() => { if (window.confirm('Voltar o acesso para esta versão? A versão atual também fica guardada.')) restore(h); }}>Restaurar esta versão</Button>}
              </div>
            ))}
            <h4 className="text-sm font-semibold pt-2">Visualizações recentes</h4>
            {(viewsQ.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Ninguém abriu a senha ainda.</p>}
            {(viewsQ.data ?? []).map(v => <p key={v.id} className="text-xs text-muted-foreground">{fmtDT(v.viewed_at)} · {v.acao}</p>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
