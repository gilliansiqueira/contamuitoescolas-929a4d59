# Operações de Santa Mônica R$ 17.697,00 acima

## De onde vem a diferença
O certo em setembro é **-R$ 22.070,00**: Distribuição de lucros R$ 14.000 + Saída Aporte R$ 4.570 + Compra da Escola R$ 3.500. O Fluxo Diário mostra -R$ 39.767,00. A diferença de **R$ 17.697,00** tem duas partes:
- **R$ 7.000,00:** previsão antiga "Pagar - Murilo Natal (Pro-Labore)" de 14/09. Esse período já tem o realizado do banco, mas a coluna Operações ainda soma a previsão junto com o realizado.
- **R$ 10.697,00:** lançamentos marcados como Ignorar, que hoje entram na coluna Operações:
  - saída de R$ 10.000 para a MFLC;
  - saída de R$ 697 para a Flash;
  - parte de uma saída para a Fernandes e Aguiar;
  - entrada de R$ 450 da Upgrade.

## O que vou fazer
1. **Operações só com o realizado até o último dia com extrato (24/09):** nesses dias a coluna Operações mostra apenas o que aconteceu no banco. Depois de 24/09 continua mostrando as previsões. A previsão de R$ 7.000 continua guardada, só deixa de ser somada.
2. **Ignorar fora das Operações, mas dentro do saldo** (sua escolha): o Ignorar sai da coluna e da linha de Operações no Fluxo Diário, no Dashboard e na prévia. Continua contando no saldo, que segue batendo com o banco. Aparece de forma discreta como **"Ignorados (banco)"**, só quando houver valor: um detalhe no dia, no total do Fluxo Diário e uma linha no Dashboard.
3. **Conferir em Santa Mônica, setembro:**
   - Operações -R$ 22.070,00;
   - Ignorados (banco) -R$ 10.697,00;
   - saldo realizado R$ 16.171,52 em 24/09, sem mudança.
   - As outras empresas não mudam.

## Detalhes técnicos
- `DailyFlowTable.tsx`: separar os lançamentos `IGNORADO_ENTRADA`/`IGNORADO_SAIDA` em um novo campo `ignorados`, que conta no saldo mas não em `operacoes`. Nos dias até o último dia realizado, `operacoes` passa a usar só `operacoesReal`.
- `periodMovement.ts` (`buildMonthMovement`): expor `ignoradosBanco` separado de `operacoesIn/Out`, mantendo `saldoMovimento` igual. O Dashboard, o PDF e `ActivationPreview` passam a mostrar a linha "Ignorados (banco)" quando ela for diferente de zero.
- Verificar se a previsão de R$ 7.000 também entra nas operações realizadas do Dashboard e aplicar o mesmo corte de data se entrar.
