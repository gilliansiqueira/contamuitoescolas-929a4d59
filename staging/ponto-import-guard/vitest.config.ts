// Config isolada dos testes desta pasta (ambiente node, sem o app).
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["staging/ponto-import-guard/*.test.ts"] } });
