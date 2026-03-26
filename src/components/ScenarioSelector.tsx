import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye } from 'lucide-react';

export type ScenarioType = 'real' | 'pessimista' | 'otimista';

interface ScenarioSelectorProps {
  value: ScenarioType;
  onChange: (v: ScenarioType) => void;
}

const scenarios: { key: ScenarioType; label: string; color: string }[] = [
  { key: 'real', label: '📊 Real', color: 'text-foreground' },
  { key: 'pessimista', label: '📉 Pessimista', color: 'text-destructive' },
  { key: 'otimista', label: '📈 Otimista', color: 'text-primary' },
];

export function ScenarioSelector({ value, onChange }: ScenarioSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Eye className="w-4 h-4 text-muted-foreground" />
      <Select value={value} onValueChange={(v) => onChange(v as ScenarioType)}>
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {scenarios.map(s => (
            <SelectItem key={s.key} value={s.key}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
