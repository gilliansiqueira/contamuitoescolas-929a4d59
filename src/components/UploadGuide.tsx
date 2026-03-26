import { useState } from 'react';
import { ExclusionRule } from '@/types/financial';
import { getRules, addRule, deleteRule } from '@/lib/storage';
import { UPLOAD_TYPES } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, BookOpen, Shield, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';

interface UploadGuideProps {
  schoolId: string;
}

export function UploadGuide({ schoolId }: UploadGuideProps) {
  const [rules, setRules] = useState<ExclusionRule[]>(getRules(schoolId));
  const [newRule, setNewRule] = useState({
    tipo: 'receita' as 'receita' | 'despesa',
    campo: 'descricao' as 'descricao' | 'categoria',
    operador: 'contem' as 'contem' | 'igual',
    valor: '',
    acao: 'ignorar' as 'ignorar' | 'recategorizar',
    novaCategoria: '',
  });

  const handleAdd = () => {
    if (!newRule.valor.trim()) return;
    const rule: ExclusionRule = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      ...newRule,
    };
    addRule(rule);
    setRules(getRules(schoolId));
    setNewRule({ tipo: 'receita', campo: 'descricao', operador: 'contem', valor: '', acao: 'ignorar', novaCategoria: '' });
  };

  const handleDelete = (id: string) => {
    deleteRule(id);
    setRules(getRules(schoolId));
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Instruções de Upload</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {UPLOAD_TYPES.map(ut => (
            <div key={ut.key} className="bg-surface rounded-lg p-4 space-y-2">
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

      {/* Rules */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-secondary" />
          <h3 className="font-display font-semibold">Regras por Escola</h3>
        </div>

        {/* Existing rules */}
        <div className="space-y-2 mb-4">
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma regra configurada</p>
          )}
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                r.tipo === 'receita' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
              }`}>
                {r.tipo}
              </span>
              <span className="text-muted-foreground">Se {r.campo} {r.operador}</span>
              <span className="font-medium">"{r.valor}"</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium text-secondary">
                {r.acao === 'ignorar' ? 'Ignorar' : `Recategorizar → ${r.novaCategoria}`}
              </span>
              <button onClick={() => handleDelete(r.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add rule */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Adicionar regra</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-[10px] text-muted-foreground">Tipo</label>
              <select value={newRule.tipo} onChange={e => setNewRule({ ...newRule, tipo: e.target.value as any })}
                className="block w-full h-9 px-2 text-xs rounded-md bg-surface border border-border">
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Campo</label>
              <select value={newRule.campo} onChange={e => setNewRule({ ...newRule, campo: e.target.value as any })}
                className="block w-full h-9 px-2 text-xs rounded-md bg-surface border border-border">
                <option value="descricao">Descrição</option>
                <option value="categoria">Categoria</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Operador</label>
              <select value={newRule.operador} onChange={e => setNewRule({ ...newRule, operador: e.target.value as any })}
                className="block w-full h-9 px-2 text-xs rounded-md bg-surface border border-border">
                <option value="contem">Contém</option>
                <option value="igual">Igual</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-muted-foreground">Valor</label>
              <Input value={newRule.valor} onChange={e => setNewRule({ ...newRule, valor: e.target.value })}
                className="bg-surface h-9 text-xs" placeholder="ex: transferência" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Ação</label>
              <select value={newRule.acao} onChange={e => setNewRule({ ...newRule, acao: e.target.value as any })}
                className="block w-full h-9 px-2 text-xs rounded-md bg-surface border border-border">
                <option value="ignorar">Ignorar</option>
                <option value="recategorizar">Recategorizar</option>
              </select>
            </div>
            {newRule.acao === 'recategorizar' && (
              <div className="min-w-[120px]">
                <label className="text-[10px] text-muted-foreground">Nova Categoria</label>
                <Input value={newRule.novaCategoria} onChange={e => setNewRule({ ...newRule, novaCategoria: e.target.value })}
                  className="bg-surface h-9 text-xs" placeholder="ex: despesas financeiras" />
              </div>
            )}
            <Button size="sm" onClick={handleAdd} className="gradient-green text-primary-foreground h-9">
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
