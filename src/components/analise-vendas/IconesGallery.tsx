import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useSAIcons, useUploadSAIcon, useDeleteSAIcon } from './useSAIcons';

interface Props { schoolId: string; }

export function IconesGallery({ schoolId }: Props) {
  const { isAdmin } = useAuth();
  const { data: icons = [] } = useSAIcons(schoolId);
  const upload = useUploadSAIcon(schoolId);
  const del = useDeleteSAIcon(schoolId);

  const [name, setName] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(png|jpe?g|svg|webp|gif)$/i.test(f.name)) {
      toast.error('Use PNG, JPG, SVG, WEBP ou GIF.');
      return;
    }
    if (f.size > 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 1MB).');
      return;
    }
    try {
      await upload.mutateAsync({ file: f, name, isGlobal: isGlobal && isAdmin });
      toast.success('Ícone enviado!');
      setName('');
      setIsGlobal(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar ícone');
    }
  }

  const globais = icons.filter(i => i.is_global);
  const escola = icons.filter(i => !i.is_global);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Galeria de ícones</CardTitle>
        <p className="text-sm text-muted-foreground">
          Faça upload de ícones e reutilize em produtos. Ícones globais ficam disponíveis para todas as empresas (apenas administradores).
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="p-3 rounded-xl border bg-muted/40 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome (opcional)</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Camiseta, PIX..." className="h-9" />
            </div>
            <div className="flex items-end">
              <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="w-full">
                {upload.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Upload
              </Button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Switch id="global" checked={isGlobal} onCheckedChange={setIsGlobal} />
              <Label htmlFor="global" className="text-sm cursor-pointer">
                Ícone global (visível para todas as empresas)
              </Label>
            </div>
          )}
          <p className="text-xs text-muted-foreground">PNG, JPG, SVG, WEBP ou GIF — máx. 1MB.</p>
        </div>

        {globais.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Globais ({globais.length})</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {globais.map(ic => (
                <IconTile key={ic.id} icon={ic} canDelete={isAdmin} onDelete={() => del.mutate(ic.id)} />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Da empresa ({escola.length})</p>
          {escola.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum ícone enviado ainda.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {escola.map(ic => (
                <IconTile key={ic.id} icon={ic} canDelete={true} onDelete={() => del.mutate(ic.id)} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IconTile({ icon, canDelete, onDelete }: { icon: { name: string; file_url: string }; canDelete: boolean; onDelete: () => void }) {
  return (
    <div className="group relative aspect-square rounded-lg border bg-card p-2 flex items-center justify-center">
      <img src={icon.file_url} alt={icon.name} className="w-full h-full object-contain" />
      {canDelete && (
        <button
          onClick={onDelete}
          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Excluir"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      <div className="absolute bottom-0 inset-x-0 text-[10px] text-center bg-background/80 backdrop-blur px-1 truncate rounded-b-lg">
        {icon.name}
      </div>
    </div>
  );
}
