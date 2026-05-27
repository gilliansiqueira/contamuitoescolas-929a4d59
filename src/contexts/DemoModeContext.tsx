import { createContext, useContext, ReactNode } from 'react';
import { DEMO_SCHOOL_ID } from '@/lib/demo';

interface DemoModeValue {
  isDemo: boolean;
  demoSchoolId: string;
}

const Ctx = createContext<DemoModeValue>({ isDemo: false, demoSchoolId: DEMO_SCHOOL_ID });

export function DemoModeProvider({ children }: { children: ReactNode }) {
  return (
    <Ctx.Provider value={{ isDemo: true, demoSchoolId: DEMO_SCHOOL_ID }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDemoMode() {
  return useContext(Ctx);
}
