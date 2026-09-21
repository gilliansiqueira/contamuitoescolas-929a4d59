import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export interface NavSheetItem {
  key: string;
  label: string;
  icon?: any;
  active?: boolean;
  onSelect: () => void;
}

export interface NavSheetSection {
  title: string;
  items: NavSheetItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NavSheetSection[];
}

/** Menu completo de navegação em folha inferior (mobile). Apenas apresentação. */
export function MobileNavSheet({ open, onOpenChange, sections }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <SheetHeader className="text-left mb-2">
          <SheetTitle className="text-base">Navegar</SheetTitle>
        </SheetHeader>
        <div className="space-y-5">
          {sections.filter(s => s.items.length > 0).map(section => (
            <div key={section.title}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {section.title}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {section.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        item.onSelect();
                        onOpenChange(false);
                      }}
                      className={`min-h-[72px] flex flex-col items-center justify-center gap-1.5 px-1.5 py-2 rounded-xl border text-[10px] font-semibold text-center leading-tight transition-colors ${
                        item.active
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-muted/40 border-transparent text-muted-foreground active:bg-muted'
                      }`}
                    >
                      {Icon && <Icon className="w-5 h-5" />}
                      <span className="line-clamp-2">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
