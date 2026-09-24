# Resumo por Responsável na Central de Clientes

## Objetivo

Transformar a aba "Por Responsável" em um resumo por pessoa: um cartão por responsável (ex.: Ana Carolina) com os percentuais e o estado das empresas sob a responsabilidade dela — sem repetir a lista completa da Carteira de Clientes.

## Decisões aprovadas

- **Percentuais:** dois, separados — conciliação e fechamento (média das empresas da responsável, sem número único).
- **Detalhe:** clicar no cartão expande, logo abaixo, uma lista compacta apenas com as empresas dela.
- **Números no cartão:** quantidade de empresas, quantas finalizadas / atrasadas / aguardando cliente, e total de pendências.

## Escopo

- Apenas `src/components/management/ManagementCenter.tsx` — mudança visual/agrupamento.
- Sem alterações de banco, migrations, permissões, cálculos, PDFs ou do Fluxo Bancário.

## Comportamento

1. **Aba "Por Responsável"** deixa de renderizar a tabela da carteira e passa a renderizar uma grade de cartões (uma por `responsible_user_id` com responsável definida).
2. **Cada cartão mostra:**
   - Nome da responsável (email).
   - Quantidade de empresas sob a responsabilidade dela.
   - Barra + % de conciliação (média dos `reconciliation_percent` das empresas dela; indisponível se todas forem nulas).
   - Barra + % de fechamento (média dos `closing_percent`, mesma regra).
   - Contadores coloridos: finalizadas, atrasadas, aguardando cliente (usando a mesma função `statusOf` já existente).
   - Total de pendências (soma de `reconciliation_pending + checklist_pending`), com destaque quando > 0.
3. **Clique no cartão** expande/retrai a lista compacta das empresas dela: nome da empresa, situação (badge existente) e botão "Acessar". Sem as colunas completas da carteira.
4. **Filtros continuam funcionando:** busca (por empresa ou responsável), mês e situação filtram os dados antes de agrupar; cartão só aparece se sobrar ao menos uma empresa da responsável após o filtro.
5. **Responsável não definida:** empresas sem responsável ficam agrupadas num cartão "Não definida" ao final, para nada sumir da visão.
6. **Ordenação:** alfabética por email da responsável; "Não definida" por último.

## Detalhes técnicos

- Agrupamento com `useMemo` sobre `rows` já carregadas por `useManagementPortfolio(month, true)` — nenhuma nova chamada ao banco.
- Médias aritméticas simples ignorando valores nulos; se todos nulos, exibir "Indisponível" (mesma convenção da tabela atual).
- Estado de expansão: `useState<Set<string>>` com o id da responsável.
- Mobile: cartões empilham; lista expandida em coluna única. Semântica de acessível: botão no cabeçalho do cartão com `aria-expanded`.
- Temas claro/noturno preservados usando os tokens existentes (`bg-card`, `text-muted-foreground`, cores de status já usadas).

## Reversão

Mudança isolada em um único arquivo; reverter o arquivo restaura a aba anterior.
