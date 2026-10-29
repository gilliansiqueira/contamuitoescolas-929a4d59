import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setPdfPasswordRequester } from '@/lib/pdfPassword';

export function PdfPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [value, setValue] = useState('');
  const resolver = useRef<((v: string | null) => void) | null>(null);

  useEffect(() => {
    setPdfPasswordRequester(({ wrong }) => new Promise(resolve => {
      resolver.current = resolve; setWrong(wrong); setValue(''); setOpen(true);
    }));
    return () => setPdfPasswordRequester(null);
  }, []);

  const finish = (v: string | null) => { setOpen(false); resolver.current?.(v); resolver.current = null; };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) finish(null); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Senha do PDF</DialogTitle>
          <DialogDescription>Este arquivo é protegido por senha. Ela é usada só para abrir o arquivo e não fica salva.</DialogDescription>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); if (value) finish(value); }} className="space-y-2">
          <Label htmlFor="pdf-pass">Senha</Label>
          <Input id="pdf-pass" type="password" autoFocus value={value} onChange={e => setValue(e.target.value)} autoComplete="off" />
          {wrong && <p className="text-sm text-destructive">Senha incorreta. Tente de novo.</p>}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => finish(null)}>Cancelar</Button>
            <Button type="submit" disabled={!value}>Abrir</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
