import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, ClipboardCheck, Table2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
}

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatMonth(m: string) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo) - 1]}/${y?.slice(2) || ''}`;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ExportacaoDados({ schoolId }: Props) {
  const [mesFilter, setMesFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [formato, setFormato] = useState<'numerico' | 'formatado'>('formatado');

  const { data: entries = [] } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('realized_entries').select('*').eq('school_id', schoolId).order('data');
      if (error) throw error;
      return data;
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data;
    },
  });

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    entries.forEach(e => { const m = e.data?.slice(0, 7); if (m && m.length === 7) meses.add(m); });
    return Array.from(meses).sort();
  }, [entries]);

  const activeMes = mesFilter === 'all'
    ? (mesesDisponiveis.length > 0 ? mesesDisponiveis[mesesDisponiveis.length - 1] : '')
    : mesFilter;

  const filtered = useMemo(() => {
    if (mesFilter === 'all') return entries;
    return entries.filter(e => e.data?.startsWith(mesFilter));
  }, [entries, mesFilter]);

  const contaGrupoMap = useMemo(() => {
    const map: Record<string, string> = {};
    contas.forEach(c => {
      if (c.nivel > 1) {
        map[normalizeStr(c.nome)] = c.grupo || 'Outros';
      }
    });
    return map;
  }, [contas]);

  const tsvData = useMemo(() => {
    const rows: { mae: string; filha: string; valor: number }[] = [];
    const subcatTotals: Record<string, Record<string, number>> = {};

    filtered.forEach(e => {
      const catName = e.conta_nome || '';
      const grupo = contaGrupoMap[normalizeStr(catName)] || 'Outros';
      if (!subcatTotals[grupo]) subcatTotals[grupo] = {};
      subcatTotals[grupo][catName || 'Outros'] = (subcatTotals[grupo][catName || 'Outros'] || 0) + Number(e.valor || 0);
    });

    Object.entries(subcatTotals)
      .sort((a, b) => {
        const totalA = Object.values(a[1]).reduce((s, v) => s + v, 0);
        const totalB = Object.values(b[1]).reduce((s, v) => s + v, 0);
        return totalA - totalB;
      })
      .forEach(([mae, filhas]) => {
        Object.entries(filhas)
          .sort((a, b) => b[1] - a[1])
          .forEach(([filha, valor]) => {
            rows.push({ mae, filha, valor });
          });
      });

    return rows;
  }, [filtered, contaGrupoMap]);

  const exportText = useMemo(() => {
    const header = 'Categoria Mãe\tCategoria Filha\tValor';
    const lines = tsvData.map(r => {
      const val = formato === 'formatado' ? formatCurrency(r.valor) : r.valor.toFixed(2);
      return `${r.mae}\t${r.filha}\t${val}`;
    });
    return [header, ...lines].join('\n');
  }, [tsvData, formato]);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      toast.success('Dados copiados! Cole em Excel, Google Sheets ou Canva.');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (entries.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="py-12 text-center">
          <Table2 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum dado importado ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Último mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Último mês</SelectItem>
            {mesesDisponiveis.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={formato} onValueChange={(v) => setFormato(v as 'numerico' | 'formatado')}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="formatado">R$ (apresentação)</SelectItem>
            <SelectItem value="numerico">Numérico (Excel)</SelectItem>
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-2 ml-auto"
          onClick={handleCopy}
        >
          {copied ? <ClipboardCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiado!' : 'Copiar dados'}
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-96 rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoria Mãe</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoria Filha</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {tsvData.map((r, i) => (
                  <tr key={i} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground font-medium">{r.mae}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.filha}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">
                      {formato === 'formatado' ? formatCurrency(r.valor) : r.valor.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        {activeMes ? `Dados de ${formatMonth(activeMes)}` : ''} · {tsvData.length} linhas · Formato TSV (compatível com Excel e Google Sheets)
      </p>
    </div>
  );
}
