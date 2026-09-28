# Conciliação do dia considerando todas as empresas da responsável

## O que acontece hoje
A porcentagem de cada responsável é uma média só das empresas que tiveram extrato com movimento no dia. Empresas sem extrato enviado ficam de fora. No caso da Bella, só São José dos Pinhais entrou na conta e deu 100%.

## O que muda
- A porcentagem passa a contar **todas as empresas da responsável que usam o Fluxo Bancário**:
  - Extrato não enviado = 0% (pesa contra).
  - Extrato enviado com movimento = % conciliado.
  - Extrato enviado e sem movimento no dia = 100% (nada a conciliar).
- Cálculo por lançamentos somados quando possível; empresas sem extrato contam como uma empresa em 0%. Fórmula final: média por empresa, cada empresa com o mesmo peso.
- No card aparece um texto curto, ex.: "1 de 5 empresas com extrato".
- Empresas sem Fluxo Bancário ativado continuam fora, com "Indisponível" quando nenhuma se aplica (caso Geovanna).
- Vale para "Hoje (ao vivo)" e "Dia anterior". A visão "Mês" não muda.

## Publicação
Depois do ajuste, publicar no site oficial junto com a coluna "Atualização" já feita.

## Detalhes técnicos
- `ManagementCenter.tsx`: novo `dayPercentForGroup` — para cada linha com registro diário: `!statement_received` → 0; `recon_required === 0` → 100; senão `reconciled/recon_required`. Linhas sem registro diário (sem fluxo bancário) ficam de fora.
- Contador "X de Y empresas com extrato" no cartão da responsável.
- Somente leitura; sem migration, sem alteração de dados.
