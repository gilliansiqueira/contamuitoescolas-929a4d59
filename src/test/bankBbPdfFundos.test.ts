import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { parseBankStatementText } from '@/lib/bankStatements/parsers';
