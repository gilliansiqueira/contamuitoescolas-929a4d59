Vou corrigir os dois problemas em duas frentes independentes, sem mexer em nada além do necessário.

## 1. Projeção do Contas a Receber (sem duplicidade)

**Problema atual**: cada upload de Sponte/Cheque/Cartão/Contas a Pagar é apenas inserido — os lançamentos projetados antigos da mesma origem ficam ativos, somando com os novos.

**Correção em `src/components/FileUpload.tsx` → `handleConfirm`**:
- Antes de inserir os novos `entries`, calcular `minDate` = menor data do upload novo (apenas entries `tipoRegistro = 'projetado'`).
- Para os tipos de projeção (`sponte`, `cheque`, `cartao`, `contas_pagar`), executar:
  ```
  DELETE FROM financial_entries
  WHERE school_id = X
    AND origem = <tipo>
    AND tipo_registro = 'projetado'
    AND data >= minDate
    AND editado_manualmente = false
  ```
- Lançamentos `editado_manualmente = true` são **preservados** (lançamentos manuais do admin nunca são apagados).
- Lançamentos `tipo_registro = 'realizado'` permanecem intactos (acumulativos).
- Nada acontece para upload do tipo `fluxo` (esse é histórico de caixa, não projeção de recebíveis).
- Adicionar log de auditoria: "Substituiu projeção `<tipo>` a partir de `<minDate>` (N lançamentos antigos removidos)".
- Mostrar no preview (antes do confirmar) um aviso amarelo: "Esta importação substituirá X lançamentos projetados de `<tipo>` a partir de `<data>`".

## 2. Fechamento e consolidação de meses (Realizado)

**Problema atual**: fechar mês no Realizado só cria `period_closures` — não gera snapshot nem consolida no Histórico Financeiro. Uploads detalhados ficam pesados.

**Correção em `src/hooks/usePeriodClosures.ts` → `useCloseMonths` (módulo `realizado`)**:
- Já existe o snapshot para `projecao`. Estender o mesmo fluxo para `realizado`:
  - Para cada mês fechado, chamar uma nova função `computeRealizadoMonthSnapshot(schoolId, month)` em `src/lib/snapshotUtils.ts` que agrega `realized_entries` por tipo (receita / despesa / operação) — totais consolidados.
  - Gravar em `period_closure_snapshots` com `module='realizado'`.
  - **Adicionalmente**: fazer upsert dos totais agregados em `historical_monthly` (para que o histórico financeiro da Projeção também fique alimentado automaticamente). Cada `tipo_valor` ganha uma linha com o valor consolidado.

**Permitir excluir uploads detalhados de meses fechados**:
- Em `src/components/realizado/HistoricoUploads.tsx`, exibir badge "Mês fechado — pode excluir" para uploads cujo `data` esteja inteiramente em meses com snapshot de realizado.
- O delete já existe; só precisa garantir que ao deletar um upload de mês fechado o sistema continue funcionando (consumindo do snapshot/historical_monthly em vez de re-agregar `realized_entries`).

**Garantir que meses fechados não recalculem**:
- Onde o Dashboard/relatórios consomem `realized_entries` agregados, adicionar um `useSnapshotMap(schoolId, 'realizado')` (já existe o hook genérico) e priorizar o snapshot quando presente — mesma lógica já usada para projeção.

## Alterações no banco

Nenhuma migração nova: as tabelas `period_closure_snapshots` e `historical_monthly` já existem e já aceitam `module='realizado'`. Os triggers existentes não bloqueiam consolidação porque `is_admin()` (e fechamento é admin-only) faz bypass.

## Arquivos afetados

- `src/components/FileUpload.tsx` — substituição de projeção por origem antes do insert.
- `src/lib/snapshotUtils.ts` — adicionar `computeRealizadoMonthSnapshot`.
- `src/hooks/usePeriodClosures.ts` — estender `useCloseMonths` para gerar snapshot + upsert em `historical_monthly` quando `module='realizado'`.
- `src/components/realizado/HistoricoUploads.tsx` — badge informando que upload pode ser excluído com segurança.
- (Opcional) componentes do Realizado que agregam totais — passar a preferir snapshot quando mês fechado.

## O que NÃO será alterado

- Lógica de classificação por tipo
- Upload do fluxo de caixa
- Estrutura de tabelas
- Fluxo de fechamento da Projeção (já existente)
- Lançamentos manuais do admin (preservados em qualquer reupload)
- Realizado vs Projetado — continuam isolados