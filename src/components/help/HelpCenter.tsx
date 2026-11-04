import { useMemo, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, CheckCircle2, ChevronLeft, HelpCircle, Pencil, Search, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logActivity } from '@/lib/teamActivity';

const db = supabase as any;

// Tela atual (para a ajuda abrir já no guia daquela tela).
let currentScreen: string | null = null;
const subs = new Set<() => void>();
export function setHelpScreen(s: string | null) { currentScreen = s; subs.forEach(f => f()); }
const useScreen = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => currentScreen);

interface Article { id: string; slug: string; tela: string | null; titulo: string; resumo: string | null; conteudo: string; ordem: number; trilha: boolean; versao: number; updated_at: string }

/** Renderização simples: "## título", "1. passo", "- item", "**negrito**", "> dica". */
function Rich({ text }: { text: string }) {
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p);
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split('\n').map((l, i) => {
        const t = l.trim();
        if (!t) return <div key={i} className="h-1" />;
        if (t.startsWith('## ')) return <h4 key={i} className="pt-2 font-semibold text-foreground">{t.slice(3)}</h4>;
        if (t.startsWith('> ')) return <p key={i} className="rounded-md border-l-4 border-l-warning bg-warning/10 px-3 py-1.5 text-xs">{bold(t.slice(2))}</p>;
        const n = t.match(/^(\d+)\.\s+(.*)$/);
        if (n) return <div key={i} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{n[1]}</span><span>{bold(n[2])}</span></div>;
        if (t.startsWith('- ')) return <div key={i} className="flex gap-2 pl-1"><span className="text-primary">•</span><span>{bold(t.slice(2))}</span></div>;
        return <p key={i}>{bold(t)}</p>;
      })}
    </div>
  );
}

export function HelpCenter() {
  const { user, isAdmin, isSuperAdmin } = useAuth() as any;
  const qc = useQueryClient();
  const screen = useScreen();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Article | null>(null);
  const [busca, setBusca] = useState('');
  const [edit, setEdit] = useState<Article | null>(null);
  const [pergunta, setPergunta] = useState('');
  const [resp, setResp] = useState<{ sabe: boolean; resposta: string; fontes: string[] } | null>(null);
  const [asking, setAsking] = useState(false);

  const q = useQuery({
    queryKey: ['help-articles'], enabled: open && !!isAdmin,
    queryFn: async () => {
      const [a, p] = await Promise.all([
        db.from('help_articles').select('*').order('ordem'),
        db.from('help_progress').select('article_id').eq('user_id', user.id),
      ]);
      return { arts: (a.data ?? []) as Article[], done: new Set(((p.data ?? []) as any[]).map(r => r.article_id as string)) };
    },
  });
  const qq = useQuery({
    queryKey: ['help-questions-open'], enabled: open && !!isSuperAdmin,
    queryFn: async () => { const { data } = await db.from('help_questions').select('id,pergunta,created_at,user_id').eq('respondida', false).order('created_at', { ascending: false }).limit(30); return (data ?? []) as any[]; },
  });

  const arts = q.data?.arts ?? [];
  const done = q.data?.done ?? new Set<string>();
  const trilha = arts.filter(a => a.trilha);
  const doneCount = trilha.filter(a => done.has(a.id)).length;
  const here = screen ? arts.filter(a => a.tela === screen) : [];
  const list = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return arts.filter(a => !t || `${a.titulo} ${a.resumo ?? ''} ${a.conteudo}`.toLowerCase().includes(t));
  }, [arts, busca]);

  if (!isAdmin) return null;

  const openArticle = (a: Article) => { setSel(a); logActivity('guia_lido', { ref: a.slug }); };
  const toggleDone = async (a: Article) => {
    if (done.has(a.id)) await db.from('help_progress').delete().eq('user_id', user.id).eq('article_id', a.id);
    else await db.from('help_progress').insert({ user_id: user.id, article_id: a.id });
    qc.invalidateQueries({ queryKey: ['help-articles'] });
  };
  const ask = async () => {
    if (pergunta.trim().length < 3) return;
    setAsking(true); setResp(null);
    const { data, error } = await supabase.functions.invoke('help-ask', { body: { pergunta } });
    setAsking(false);
    if (error || data?.error) return toast.error(data?.error ?? 'Não foi possível responder agora.');
    setResp(data);
  };
  const saveEdit = async () => {
    if (!edit) return;
    const row = { slug: edit.slug.trim(), titulo: edit.titulo.trim(), resumo: edit.resumo, conteudo: edit.conteudo, tela: edit.tela || null, ordem: edit.ordem, trilha: edit.trilha };
    const r = edit.id ? await db.from('help_articles').update(row).eq('id', edit.id) : await db.from('help_articles').insert(row);
    if (r.error) return toast.error('Não foi possível salvar o guia.');
    toast.success('Guia salvo. A versão anterior ficou guardada.');
    setEdit(null); setSel(null); qc.invalidateQueries({ queryKey: ['help-articles'] });
  };

  const Item = ({ a }: { a: Article }) => (
    <button type="button" onClick={() => openArticle(a)} className="flex w-full items-start gap-2 rounded-md border bg-card px-3 py-2 text-left hover:bg-muted/40">
      {done.has(a.id) ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{a.titulo}</span>{a.resumo && <span className="block text-xs text-muted-foreground">{a.resumo}</span>}</span>
    </button>
  );

  return (
    <>
      <Button size="icon" variant="outline" aria-label="Ajuda e passo a passo" title="Ajuda e passo a passo" onClick={() => setOpen(true)}
        className="fixed bottom-4 right-[4.25rem] z-50 h-11 w-11 rounded-full bg-card shadow-lg">
        <HelpCircle className="h-5 w-5 text-primary" />
      </Button>
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setSel(null); setEdit(null); } }}>
        <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" />Ajuda da equipe</DialogTitle>
            <DialogDescription>Passo a passo das tarefas, trilha de treinamento e tira-dúvidas.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {edit ? (
              <div className="space-y-2">
                <Input placeholder="Título" value={edit.titulo} onChange={e => setEdit({ ...edit, titulo: e.target.value })} />
                <Input placeholder="Resumo (uma linha)" value={edit.resumo ?? ''} onChange={e => setEdit({ ...edit, resumo: e.target.value })} />
                <div className="flex gap-2">
                  <Input placeholder="identificador" value={edit.slug} disabled={!!edit.id} onChange={e => setEdit({ ...edit, slug: e.target.value })} />
                  <Input placeholder="tela (ex.: bank_flow)" value={edit.tela ?? ''} onChange={e => setEdit({ ...edit, tela: e.target.value })} />
                  <Input type="number" className="w-24" value={edit.ordem} onChange={e => setEdit({ ...edit, ordem: Number(e.target.value) })} />
                </div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={edit.trilha} onChange={e => setEdit({ ...edit, trilha: e.target.checked })} />Faz parte da trilha do novo funcionário</label>
                <Textarea rows={16} className="font-mono text-xs" value={edit.conteudo} onChange={e => setEdit({ ...edit, conteudo: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">Use "## Título", "1. passo", "- item", "**negrito**" e "&gt; dica".</p>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={saveEdit}>Salvar guia</Button></div>
              </div>
            ) : sel ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSel(null)}><ChevronLeft className="mr-1 h-4 w-4" />Voltar</Button>
                  <span className="flex-1" />
                  {isSuperAdmin && <Button size="sm" variant="outline" onClick={() => setEdit(sel)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>}
                </div>
                <h3 className="text-lg font-semibold">{sel.titulo}</h3>
                <Rich text={sel.conteudo} />
                <div className="flex items-center gap-2 border-t pt-3">
                  <span className="flex-1 text-[11px] text-muted-foreground">Versão {sel.versao} · atualizado em {new Date(sel.updated_at).toLocaleDateString('pt-BR')}</span>
                  <Button size="sm" variant={done.has(sel.id) ? 'secondary' : 'default'} onClick={() => toggleDone(sel)}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />{done.has(sel.id) ? 'Concluído' : 'Concluí este guia'}
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue={here.length ? 'tela' : 'trilha'}>
                <TabsList className="flex-wrap">
                  {here.length > 0 && <TabsTrigger value="tela">Nesta tela</TabsTrigger>}
                  <TabsTrigger value="trilha">Trilha ({doneCount}/{trilha.length})</TabsTrigger>
                  <TabsTrigger value="todos">Todos os guias</TabsTrigger>
                  <TabsTrigger value="perguntar">Perguntar</TabsTrigger>
                  {isSuperAdmin && <TabsTrigger value="sem">Sem resposta ({qq.data?.length ?? 0})</TabsTrigger>}
                </TabsList>
                {here.length > 0 && <TabsContent value="tela" className="space-y-1.5">{here.map(a => <Item key={a.id} a={a} />)}</TabsContent>}
                <TabsContent value="trilha" className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Leia na ordem e clique em "Concluí" no fim de cada guia.</p>
                  {trilha.map(a => <Item key={a.id} a={a} />)}
                </TabsContent>
                <TabsContent value="todos" className="space-y-1.5">
                  <div className="flex gap-2">
                    <div className="relative flex-1"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar (ex.: extrato, Sponte)" value={busca} onChange={e => setBusca(e.target.value)} /></div>
                    {isSuperAdmin && <Button variant="outline" onClick={() => setEdit({ id: '', slug: '', tela: null, titulo: '', resumo: '', conteudo: '', ordem: (arts.at(-1)?.ordem ?? 0) + 10, trilha: true, versao: 1, updated_at: '' })}>Novo guia</Button>}
                  </div>
                  {list.map(a => <Item key={a.id} a={a} />)}
                  {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
                </TabsContent>
                <TabsContent value="perguntar" className="space-y-2">
                  <Textarea rows={3} placeholder="Ex.: como subo o extrato do Bradesco em PDF?" value={pergunta} onChange={e => setPergunta(e.target.value)} />
                  <Button onClick={ask} disabled={asking || pergunta.trim().length < 3}><Send className="mr-1 h-4 w-4" />{asking ? 'Procurando nos guias…' : 'Perguntar'}</Button>
                  <p className="text-[11px] text-muted-foreground">A resposta usa só os guias cadastrados. Quando eles não cobrem a pergunta, ela vai para a gestora.</p>
                  {resp && (
                    <div className={`rounded-md border p-3 ${resp.sabe ? '' : 'border-warning bg-warning/10'}`}>
                      <Rich text={resp.resposta} />
                      {resp.fontes.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{resp.fontes.map(f => { const a = arts.find(x => x.slug === f); return a ? <Badge key={f} variant="outline" className="cursor-pointer" onClick={() => openArticle(a)}>Guia: {a.titulo}</Badge> : null; })}</div>}
                    </div>
                  )}
                </TabsContent>
                {isSuperAdmin && <TabsContent value="sem" className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Perguntas que os guias não responderam — bom sinal de qual guia escrever ou completar.</p>
                  {(qq.data ?? []).map(x => <div key={x.id} className="rounded-md border px-3 py-2 text-sm">{x.pergunta}<span className="block text-[11px] text-muted-foreground">{new Date(x.created_at).toLocaleString('pt-BR')}</span></div>)}
                </TabsContent>}
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
