import { useMemo, useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  Settings, Plus, Trash2, Upload, CreditCard, Smartphone, Receipt,
  Banknote, FileText, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePresentation } from '@/components/presentation-provider';

interface Props {
  schoolId: string;
}

interface PaymentMethod {
  id: string;
  school_id: string;
  method_key: string;
  label: string;
  enabled: boolean;
  sort_order: number;
}

interface CardBrand {
  id: string;
  school_id: string;
  name: string;
  icon_url: string | null;
  sort_order: number;
}

interface SalesRow {
  id: string;
  school_id: string;
  method_key: string;
  brand_id: string | null;
  month: string; // YYYY-MM
  value: number;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const DEFAULT_METHODS: { key: string; label: string }[] = [
  { key: 'credito', label: 'Cartão de crédito' },
  { key: 'debito', label: 'Cartão de débito' },
  { key: 'pix', label: 'Pix' },
  { key: 'boleto', label: 'Boleto' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'dinheiro', label: 'Dinheiro' },
];

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  credito: CreditCard,
  debito: CreditCard,
  pix: Smartphone,
  boleto: Receipt,
  cheque: FileText,
  dinheiro: Banknote,
};

const METHOD_COLORS: Record<string, string> = {
  credito: 'hsl(217 91% 60%)',
  debito: 'hsl(280 67% 55%)',
  pix: 'hsl(142 71% 45%)',
  boleto: 'hsl(45 93% 47%)',
  cheque: 'hsl(0 84% 60%)',
  dinheiro: 'hsl(180 60% 45%)',
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function parseBR(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

export function VendasDashboard({ schoolId }: Props) {
  const { isPresentationMode } = usePresentation();
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>('todos');

  // ── Fetch ──
  const { data: methods = [], isLoading: lm } = useQuery({
    queryKey: ['sales_payment_methods', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_payment_methods')
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order');
      if (error) throw error;
      return data as PaymentMethod[];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['sales_card_brands', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_card_brands')
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order');
      if (error) throw error;
      return data as CardBrand[];
    },
  });

  const { data: salesData = [], isLoading: ls } = useQuery({
    queryKey: ['sales_data', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_data')
        .select('*')
        .eq('school_id', schoolId);
      if (error) throw error;
      return data as SalesRow[];
    },
  });

  // ── Seed defaults on first visit ──
  useEffect(() => {
    if (!lm && methods.length === 0 && schoolId) {
      (async () => {
        const rows = DEFAULT_METHODS.map((m, i) => ({
          school_id: schoolId,
          method_key: m.key,
          label: m.label,
          enabled: true,
          sort_order: i,
        }));
        const { error } = await supabase.from('sales_payment_methods').insert(rows);
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['sales_payment_methods', schoolId] });
        }
      })();
    }
  }, [lm, methods.length, schoolId, queryClient]);

  // ── Mutations ──
  const toggleMethod = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('sales_payment_methods').update({ enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales_payment_methods', schoolId] }),
  });

  const addBrand = useMutation({
    mutationFn: async (name: string) => {
      const sortOrder = brands.length;
      const { error } = await supabase.from('sales_card_brands').insert({
        school_id: schoolId, name, sort_order: sortOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_card_brands', schoolId] });
      toast.success('Bandeira adicionada');
    },
  });

  const updateBrand = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CardBrand> }) => {
      const { error } = await supabase.from('sales_card_brands').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales_card_brands', schoolId] }),
  });

  const deleteBrand = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales_card_brands').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_card_brands', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['sales_data', schoolId] });
      toast.success('Bandeira removida');
    },
  });

  const saveValue = useMutation({
    mutationFn: async ({ method_key, brand_id, month, value }: {
      method_key: string; brand_id: string | null; month: string; value: number;
    }) => {
      const existing = salesData.find(s =>
        s.method_key === method_key &&
        s.month === month &&
        (s.brand_id ?? null) === (brand_id ?? null)
      );
      if (existing) {
        const { error } = await supabase.from('sales_data').update({ value }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sales_data').insert({
          school_id: schoolId, method_key, brand_id, month, value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales_data', schoolId] }),
  });

  // ── Derived data ──
  const enabledMethods = useMemo(() => methods.filter(m => m.enabled), [methods]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const now = new Date();
    years.add(String(now.getFullYear()));
    salesData.forEach(s => years.add(s.month.slice(0, 4)));
    return Array.from(years).sort().reverse();
  }, [salesData]);

  const filteredData = useMemo(() => {
    if (yearFilter === 'todos') return salesData;
    return salesData.filter(s => s.month.startsWith(yearFilter));
  }, [salesData, yearFilter]);

  // Total per method (sum brands for credit)
  const totalByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    enabledMethods.forEach(m => {
      map[m.method_key] = filteredData
        .filter(s => s.method_key === m.method_key)
        .reduce((acc, s) => acc + Number(s.value), 0);
    });
    return map;
  }, [filteredData, enabledMethods]);

  const totalByBrand = useMemo(() => {
    const map: Record<string, number> = {};
    brands.forEach(b => {
      map[b.id] = filteredData
        .filter(s => s.method_key === 'credito' && s.brand_id === b.id)
        .reduce((acc, s) => acc + Number(s.value), 0);
    });
    return map;
  }, [filteredData, brands]);

  const totalGeral = useMemo(
    () => Object.values(totalByMethod).reduce((a, b) => a + b, 0),
    [totalByMethod]
  );

  const methodChartData = useMemo(() =>
    enabledMethods.map(m => ({
      name: m.label,
      valor: totalByMethod[m.method_key] || 0,
      fill: METHOD_COLORS[m.method_key] || 'hsl(var(--primary))',
    })).filter(d => d.valor > 0),
    [enabledMethods, totalByMethod]
  );

  const brandChartData = useMemo(() =>
    brands.map(b => ({
      name: b.name,
      valor: totalByBrand[b.id] || 0,
    })).filter(d => d.valor > 0),
    [brands, totalByBrand]
  );

  if (lm || ls) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Vendas</h2>
          <p className="text-sm text-muted-foreground">Receitas por forma de pagamento e bandeira</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-input bg-background text-sm"
          >
            <option value="todos">Todos os anos</option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {!isPresentationMode && (
            <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)} className="rounded-xl">
              <Settings className="w-4 h-4 mr-1" /> Configurações
            </Button>
          )}
        </div>
      </div>

      {/* Total geral */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Total geral de vendas</div>
            <div className="text-3xl font-bold text-primary mt-1">{formatCurrency(totalGeral)}</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Method cards */}
      {enabledMethods.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enabledMethods.map(m => {
            const Icon = METHOD_ICONS[m.method_key] || Wallet;
            const total = totalByMethod[m.method_key] || 0;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: (METHOD_COLORS[m.method_key] || 'hsl(var(--primary))') + '20' }}
                        >
                          <Icon className="w-5 h-5" style={{ color: METHOD_COLORS[m.method_key] }} />
                        </div>
                        <div className="font-medium text-sm">{m.label}</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold mt-3">{formatCurrency(total)}</div>
                    {m.method_key === 'credito' && brands.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                        {brands.map(b => (
                          <div key={b.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              {b.icon_url ? (
                                <img src={b.icon_url} alt={b.name} className="w-5 h-5 object-contain" />
                              ) : (
                                <div className="w-5 h-5 rounded bg-muted" />
                              )}
                              <span className="text-muted-foreground">{b.name}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(totalByBrand[b.id] || 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Vendas por forma de pagamento</h3>
            {methodChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Sem dados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={methodChartData}
                    dataKey="valor"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {methodChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Vendas por bandeira (Crédito)</h3>
            {brandChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Sem dados de bandeiras
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={brandChartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="valor" fill="hsl(217 91% 60%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History table */}
      <SalesHistoryTable
        schoolId={schoolId}
        methods={enabledMethods}
        brands={brands}
        salesData={salesData}
        yearFilter={yearFilter}
        onSave={(args) => saveValue.mutate(args)}
      />

      {/* Config sheet */}
      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configurações de Vendas</SheetTitle>
            <SheetDescription>Formas de pagamento e bandeiras de cartão</SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="methods" className="mt-6">
            <TabsList>
              <TabsTrigger value="methods">Formas de pagamento</TabsTrigger>
              <TabsTrigger value="brands">Bandeiras</TabsTrigger>
            </TabsList>
            <TabsContent value="methods" className="mt-4 space-y-2">
              {methods.map(m => {
                const Icon = METHOD_ICONS[m.method_key] || Wallet;
                return (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color: METHOD_COLORS[m.method_key] }} />
                      <span className="text-sm font-medium">{m.label}</span>
                    </div>
                    <Switch
                      checked={m.enabled}
                      onCheckedChange={(v) => toggleMethod.mutate({ id: m.id, enabled: v })}
                    />
                  </div>
                );
              })}
            </TabsContent>
            <TabsContent value="brands" className="mt-4">
              <BrandsManager
                schoolId={schoolId}
                brands={brands}
                onAdd={(name) => addBrand.mutate(name)}
                onUpdate={(id, patch) => updateBrand.mutate({ id, patch })}
                onDelete={(id) => deleteBrand.mutate(id)}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Brands Manager
// ──────────────────────────────────────────────────────────────────────────
function BrandsManager({
  schoolId, brands, onAdd, onUpdate, onDelete,
}: {
  schoolId: string;
  brands: CardBrand[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, patch: Partial<CardBrand>) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleUpload = async (brand: CardBrand, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `${schoolId}/${brand.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('card-brand-icons').upload(path, file, { upsert: true });
    if (error) {
      toast.error('Erro no upload: ' + error.message);
      return;
    }
    const { data } = supabase.storage.from('card-brand-icons').getPublicUrl(path);
    onUpdate(brand.id, { icon_url: data.publicUrl });
    toast.success('Ícone atualizado');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome da bandeira (ex: Visa)"
          className="rounded-xl"
        />
        <Button
          onClick={() => { if (newName.trim()) { onAdd(newName.trim()); setNewName(''); } }}
          className="rounded-xl"
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {brands.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma bandeira cadastrada. Adicione bandeiras como Visa, Mastercard, Elo, Amex.
          </p>
        )}
        {brands.map(b => (
          <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border">
            <div className="w-10 h-10 rounded-lg border flex items-center justify-center bg-muted/30 shrink-0">
              {b.icon_url ? (
                <img src={b.icon_url} alt={b.name} className="w-8 h-8 object-contain" />
              ) : (
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <Input
              value={b.name}
              onChange={e => onUpdate(b.id, { name: e.target.value })}
              className="flex-1 rounded-lg h-9"
            />
            <input
              ref={el => (fileInputs.current[b.id] = el)}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleUpload(b, f);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputs.current[b.id]?.click()}
              className="rounded-lg"
            >
              <Upload className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(b.id)}
              className="rounded-lg text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// History Table — rows: years, columns: months, sub-rows per method/brand
// ──────────────────────────────────────────────────────────────────────────
function SalesHistoryTable({
  schoolId, methods, brands, salesData, yearFilter, onSave,
}: {
  schoolId: string;
  methods: PaymentMethod[];
  brands: CardBrand[];
  salesData: SalesRow[];
  yearFilter: string;
  onSave: (args: { method_key: string; brand_id: string | null; month: string; value: number }) => void;
}) {
  const { isPresentationMode } = usePresentation();
  const [selectedKey, setSelectedKey] = useState<string>(() => methods[0]?.method_key || '');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  useEffect(() => {
    if (methods.length > 0 && !methods.find(m => m.method_key === selectedKey)) {
      setSelectedKey(methods[0].method_key);
    }
  }, [methods, selectedKey]);

  const years = useMemo(() => {
    const set = new Set<string>();
    set.add(String(new Date().getFullYear()));
    salesData.forEach(s => set.add(s.month.slice(0, 4)));
    if (yearFilter !== 'todos') {
      return [yearFilter];
    }
    return Array.from(set).sort();
  }, [salesData, yearFilter]);

  const getValue = (method_key: string, brand_id: string | null, year: string, monthIdx: number): number => {
    const month = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const row = salesData.find(s =>
      s.method_key === method_key &&
      s.month === month &&
      (s.brand_id ?? null) === brand_id
    );
    return row ? Number(row.value) : 0;
  };

  const isCredito = selectedKey === 'credito';
  const brandFilter: string | null =
    !isCredito ? null
    : selectedBrand === 'all' ? null
    : selectedBrand;

  if (methods.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          Ative formas de pagamento nas configurações.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-semibold">Histórico mensal</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedKey}
              onChange={e => setSelectedKey(e.target.value)}
              className="h-9 px-3 rounded-lg border border-input bg-background text-sm"
            >
              {methods.map(m => (
                <option key={m.id} value={m.method_key}>{m.label}</option>
              ))}
            </select>
            {isCredito && brands.length > 0 && (
              <select
                value={selectedBrand}
                onChange={e => setSelectedBrand(e.target.value)}
                className="h-9 px-3 rounded-lg border border-input bg-background text-sm"
              >
                <option value="all">Total (sem bandeira)</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground sticky left-0 bg-card">Ano</th>
                {MONTH_LABELS.map(m => (
                  <th key={m} className="text-center py-2 px-1 font-medium text-muted-foreground min-w-[80px]">
                    {m}
                  </th>
                ))}
                <th className="text-center py-2 px-2 font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map(year => {
                const rowTotal = MONTH_LABELS.reduce((acc, _, i) => acc + getValue(selectedKey, brandFilter, year, i), 0);
                return (
                  <tr key={year} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-2 font-semibold sticky left-0 bg-card">{year}</td>
                    {MONTH_LABELS.map((_, i) => (
                      <td key={i} className="py-1 px-1">
                        <EditableCell
                          value={getValue(selectedKey, brandFilter, year, i)}
                          disabled={isPresentationMode}
                          onSave={(v) => onSave({
                            method_key: selectedKey,
                            brand_id: brandFilter,
                            month: `${year}-${String(i + 1).padStart(2, '0')}`,
                            value: v,
                          })}
                        />
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center font-semibold text-primary">
                      {formatCurrency(rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EditableCell({ value, onSave, disabled }: { value: number; onSave: (v: number) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (disabled) {
    return (
      <div className="text-center text-xs px-1 py-1.5">
        {value > 0 ? formatCurrency(value) : '—'}
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value > 0 ? value.toString().replace('.', ',') : '');
          setEditing(true);
        }}
        className="w-full text-center text-xs px-1 py-1.5 rounded hover:bg-muted/50 transition-colors"
      >
        {value > 0 ? formatCurrency(value) : <span className="text-muted-foreground">—</span>}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        const n = parseBR(draft);
        if (n !== value) onSave(n);
        setEditing(false);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="h-8 text-xs text-center px-1"
    />
  );
}
