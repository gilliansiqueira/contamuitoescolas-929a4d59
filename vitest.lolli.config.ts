import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['src/test/lolli.test.ts', 'src/test/ledgerEngine.test.ts', 'src/test/ledgerDll.test.ts', 'src/test/periodMovement.test.ts', 'src/test/currentDayForecast.test.ts', 'src/test/saldoBancoDashboard.test.ts', 'src/test/bankAutoInvest.test.ts', 'src/test/confirmedBalance.test.ts', 'src/test/bankCashflow.test.ts'] },
});