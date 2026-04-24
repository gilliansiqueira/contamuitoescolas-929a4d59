import { IconLibraryPicker } from '@/components/icons/IconLibraryPicker';

interface Props {
  /** Mantido por compatibilidade — biblioteca agora é global. */
  schoolId?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  size?: 'sm' | 'md';
}

/**
 * @deprecated Use IconLibraryPicker diretamente. Mantido por compatibilidade
 * enquanto migramos os pontos de uso. A biblioteca agora é global e única.
 */
export function IconPicker({ value, onChange, size = 'sm' }: Props) {
  return <IconLibraryPicker value={value} onChange={onChange} size={size} />;
}
