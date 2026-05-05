import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Save, Search, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface Props { schoolId: string; }

interface Rule {
  id: string;
  source_text: string;
  source_normalized: string;
  target_categoria: string;
  match_field: string;
  updated_at: string;
}

export function RegrasCategorizacao({ schoolId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['category_rules', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_rules')
        .select('*')
        .eq('school_id', schoolId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Rule[];
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts').select('*').eq('school_id', schoolId).order('grupo').order('nome');
      if (error) throw error;
      return data;
    },
  });
  const categoriaFilhas = useMemo(() => contas.filter((c: any) => c.nivel > 1), [contas]);

  const updateMut = useMutation({
    mutationFn: async ({ id, target }: { id: string; target: string }) => {
      const { error } = await supabase.from('category_rules').update({ target_categoria: target }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category_rules', schoolId] });
      toast.success('Regra atualizada');
      setEdits({});
    },
    onError: (e: any) => toast.error(`Erro: ${e?.message ?? ''}`),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('category_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category_rules', schoolId] });
      toast.success('Regra removida');
    },
    onError: (e: any) => toast.error(`Erro: ${e?.message ?? ''}`),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(r =>
      r.source_text.toLowerCase().includes(q) || r.target_categoria.toLowerCase().includes(q)
    );
  }, [rules, search]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Regras de Categorização Automática</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Estas regras são criadas automaticamente quando você associa manualmente uma categoria não reconhecida durante a importação. Em importações futuras, descrições iguais serão classificadas automaticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por texto ou categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {rules.length === 0 ? 'Nenhuma regra cadastrada ainda.' : 'Nenhum resultado para a busca.'}
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Texto na importação</TableHead>
                  <TableHead className="text-xs"></TableHead>
                  <TableHead className="text-xs">Categoria de destino</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const editedValue = edits[r.id];
                  const currentValue = editedValue ?? r.target_categoria;
                  const dirty = editedValue !== undefined && editedValue !== r.target_categoria;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm py-2">
                        <Badge variant="outline" className="rounded-md">{r.source_text}</Badge>
                      </TableCell>
                      <TableCell className="py-2 w-6"><ArrowRight className="w-3 h-3 text-muted-foreground" /></TableCell>
                      <TableCell className="text-sm py-2">
                        <Select
                          value={currentValue}
                          onValueChange={v => setEdits(prev => ({ ...prev, [r.id]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-lg max-w-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {categoriaFilhas.map((c: any) => (
                              <SelectItem key={c.id} value={c.nome}>{c.grupo} → {c.nome}</SelectItem>
                            ))}
                            {!categoriaFilhas.find((c: any) => c.nome === currentValue) && (
                              <SelectItem value={currentValue}>{currentValue}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {dirty && (
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => updateMut.mutate({ id: r.id, target: editedValue! })}
                              disabled={updateMut.isPending}
                              className="h-8 w-8 p-0"
                            >
                              <Save className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => {
                              if (confirm(`Remover regra para "${r.source_text}"?`)) deleteMut.mutate(r.id);
                            }}
                            disabled={deleteMut.isPending}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {rules.length > 0 && (
          <p className="text-xs text-muted-foreground">{rules.length} regra(s) cadastrada(s)</p>
        )}
      </CardContent>
    </Card>
  );
}
