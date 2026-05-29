import { useEffect } from 'react';
import Index from './Index';
import { DemoModeProvider } from '@/contexts/DemoModeContext';
import { installDemoFetchGuard, uninstallDemoFetchGuard } from '@/lib/demoFetchGuard';

export default function Demo() {
  useEffect(() => {
    installDemoFetchGuard();
    return () => uninstallDemoFetchGuard();
  }, []);

  return (
    <DemoModeProvider>
      <Index />
    </DemoModeProvider>
  );
}
