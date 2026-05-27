import Index from './Index';
import { DemoModeProvider } from '@/contexts/DemoModeContext';

export default function Demo() {
  return (
    <DemoModeProvider>
      <Index />
    </DemoModeProvider>
  );
}
