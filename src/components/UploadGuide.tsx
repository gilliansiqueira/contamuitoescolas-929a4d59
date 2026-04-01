import { useState } from 'react';
import { ExclusionRule } from '@/types/financial';
import { useExclusionRules, useAddExclusionRule, useDeleteExclusionRule } from '@/hooks/useFinancialData';
import { UPLOAD_TYPES } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, BookOpen, Shield, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface UploadGuideProps {
  schoolId: string;
}

export function UploadGuide({ schoolId }: UploadGuideProps) {
  const { data: rules = [], isLoading } = useExclusionRules(schoolId);
  const addRule = useAddExclusionRule();
  const deleteRule = useDeleteExclusionRule();

  const [newRule, setNewRule] = useState({
    tipo: 'receita' as 'receita' | 'despesa',
    campo: 'descricao' as 'descricao' | 'categoria',
    operador: 'contem' as 'contem' | 'igual',
    valor: '',
    acao: 'ignorar' as 'ignorar' | 'recategorizar',
    novaCategoria: '',
  });

  const handleAdd = async () => {
    if (!newRule.valor.trim()) return;
    const rule: ExclusionRule = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      ...newRule,
    };
    try {
      await addRule.mutateAsync(rule);
      setNewRule({ tipo: 'receita', campo: 'descricao', operador: 'contem', valor: '', acao: 'ignorar', novaCategoria: '' });
      toast.success('Regra adicionada');
    } catch {
      toast.error('Erro ao adicionar regra');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      toast.success('Regra removida');
    } catch {
      toast.error('Erro ao remover regra');
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Instruções de Upload</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {UPLOAD_TYPES.map(ut => (
            <div key={ut.key} className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-secondary" />
                <h4 className="font-semibold text-sm">{ut.label}</h4>
              </div>
              <p className="text-xs text-muted-foreground">Colunas obrigatórias:</p>
              <div className="flex flex-wrap gap-1">
                {ut.requiredColumns.map(c => (
                  <span key={c} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-medium">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-secondary/10 rounded-lg p-4 text-sm space-y-1">
          <p className="font-semibold text-secondary">⚠ Validação automática</p>
          <p className="text-xs text-muted-foreground">Ao fazer upload, o sistema valida automaticamente:</p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
            <li>Presença de colunas obrigatórias</li>
            <li>Formato de datas (DD/MM/YYYY ou YYYY-MM-DD)</li>
            <li>Valores numéricos válidos</li>
            <li>Tipo (entrada/saida) para fluxo de caixa</li>
          </ul>
          <p className="text-xs font-medium text-destructive">Arquivos com erros NÃO serão importados.</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-secondary" />
          <h3 className="font-display font-semibold">Regras por Escola</h3>
        </div>
        <div className="space-y-2 mb-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && rules.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma regra configurada</p>
          )}
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                r.tipo === 'receita' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}>
                {r.tipo}
              </span>
              <span className="text-muted-foreground">{r.campo} {r.operador} "{r.valor}"</span>
              <span className="text-muted-foreground">→ {r.acao}</span>
              {r.novaCategoria && <span className="text-primary font-medium">({r.novaCategoria})</span>}
              <button onClick={() => handleDelete(r.id)} className="ml-auto p-1 hover:text-destructive transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <select
            value={newRule.tipo}
            onChange={e => setNewRule(p => ({ ...p, tipo: e.target.value as any }))}
            className="text-xs border rounded-lg px-2 py-1.5 bg-background"
          >
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <select
            value={newRule.campo}
            onChange={e => setNewRule(p => ({ ...p, campo: e.target.value as any }))}
            className="text-xs border rounded-lg px-2 py-1.5 bg-background"
          >
            <option value="descricao">Descrição</option>
            <option value="categoria">Categoria</option>
          </select>
          <select
            value={newRule.operador}
            onChange={e => setNewRule(p => ({ ...p, operador: e.target.value as any }))}
            className="text-xs border rounded-lg px-2 py-1.5 bg-background"
          >
            <option value="contem">Contém</option>
            <option value="igual">Igual</option>
          </select>
          <select
            value={newRule.acao}
            onChange={e => setNewRule(p => ({ ...p, acao: e.target.value as any }))}
            className="text-xs border rounded-lg px-2 py-1.5 bg-background"
          >
            <option value="ignorar">Ignorar</option>
            <option value="recategorizar">Recategorizar</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Valor da regra"
            value={newRule.valor}
            onChange={e => setNewRule(p => ({ ...p, valor: e.target.value }))}
            className="text-xs h-8"
          />
          {newRule.acao === 'recategorizar' && (
            <Input
              placeholder="Nova categoria"
              value={newRule.novaCategoria}
              onChange={e => setNewRule(p => ({ ...p, novaCategoria: e.target.value }))}
              className="text-xs h-8"
            />
          )}
          <Button size="sm" onClick={handleAdd} disabled={!newRule.valor.trim()}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
