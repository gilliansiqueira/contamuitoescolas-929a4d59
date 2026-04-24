/**
 * @deprecated A galeria de ícones foi unificada em `icons_library` (global).
 * Use o IconLibraryManager em Configurações → Biblioteca de Ícones.
 * Esse componente foi mantido como redirecionamento para evitar quebras.
 */
import { IconLibraryManager } from '@/components/icons/IconLibraryManager';

export function IconesGallery(_props: { schoolId: string }) {
  return <IconLibraryManager />;
}
