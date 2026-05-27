import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-primary/15 via-primary/10 to-secondary/15 border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Eye className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>Modo Demonstração</strong> — você está visualizando dados fictícios da empresa
            "Demo". Edição e exclusão estão desativadas.
          </span>
        </div>
        <Link to="/auth">
          <Button size="sm" variant="default" className="shrink-0">
            Criar minha conta
          </Button>
        </Link>
      </div>
    </div>
  );
}
