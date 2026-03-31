import { useState } from 'react';
import { School } from '@/types/financial';
import { useSchools, useAddSchool, useDeleteSchool } from '@/hooks/useFinancialData';
import { Search, Plus, Building2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface SchoolSelectorProps {
  selectedSchool: School | null;
  onSelect: (school: School) => void;
}

export function SchoolSelector({ selectedSchool, onSelect }: SchoolSelectorProps) {
  const { data: schools = [], isLoading } = useSchools();
  const addSchoolMut = useAddSchool();
  const deleteSchoolMut = useDeleteSchool();
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = schools.filter(s =>
    s.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const data = await addSchoolMut.mutateAsync({ nome: newName.trim() });
      setNewName('');
      setShowCreate(false);
      onSelect({
        id: data.id,
        nome: data.nome,
        createdAt: data.created_at,
        saldoInicial: Number(data.saldo_inicial) || 0,
      });
      toast.success('Escola criada com sucesso!');
    } catch {
      toast.error('Erro ao criar escola');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSchoolMut.mutateAsync(deleteId);
      setDeleteId(null);
      if (selectedSchool?.id === deleteId) onSelect(null as any);
      toast.success('Escola excluída com sucesso');
    } catch {
      toast.error('Erro ao excluir escola');
    }
  };

  if (selectedSchool) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelect(null as any)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
        >
          <Building2 className="w-4 h-4" />
          {selectedSchool.nome}
        </button>
        <button
          onClick={() => setDeleteId(selectedSchool.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Excluir escola"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir escola</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza? Todos os dados vinculados serão removidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg glass-card rounded-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl gradient-green flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Projeção Financeira</h1>
          <p className="text-muted-foreground text-sm">Selecione ou crie uma escola para começar</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar escola..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-surface border-border"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {isLoading && <p className="text-center text-muted-foreground text-sm py-4">Carregando...</p>}
          <AnimatePresence>
            {filtered.map((school, i) => (
              <motion.button
                key={school.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onSelect(school)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-primary/10 transition-colors flex items-center gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="font-medium text-sm text-foreground">{school.nome}</span>
              </motion.button>
            ))}
          </AnimatePresence>
          {!isLoading && filtered.length === 0 && schools.length > 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">Nenhuma escola encontrada</p>
          )}
          {!isLoading && schools.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">Nenhuma escola cadastrada</p>
          )}
        </div>

        <div className="border-t border-border pt-4">
          {showCreate ? (
            <div className="flex gap-2">
              <Input
                placeholder="Nome da escola"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="bg-surface"
                autoFocus
              />
              <Button onClick={handleCreate} disabled={addSchoolMut.isPending} className="gradient-green text-primary-foreground shrink-0">
                {addSchoolMut.isPending ? '...' : 'Criar'}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)} className="shrink-0">
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowCreate(true)}
              className="w-full gradient-orange text-secondary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Escola
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
