# Bairro Alto – contas a receber não aparecem no Fluxo Diário

## O que já confirmei nos dados
- A planilha "A receber 3.xlsx" foi gravada hoje às 15h20 (horário de Brasília): 116 recebimentos em dezembro, que somam R$ 46.619,54 (boleto R$ 20.471,88, PIX R$ 10.432,09, débito R$ 9.271,74, crédito R$ 6.443,83).
- O print das 15h22 mostra só R$ 3.932,00 em dezembro, que é exatamente o valor dos cheques. Ou seja, a tela ainda não tinha carregado o arquivo novo.
- Não há nada nos dados de Bairro Alto que tire esses recebimentos do cálculo: nenhum fechamento de mês, nenhum lançamento do banco em dezembro e nenhuma divisão por CNPJ.
- A planilha tem R$ 96,7 mil vencendo em dezembro. Desse total, cerca de R$ 50 mil são de cartão de crédito, e o prazo configurado empurra esses valores para janeiro (janeiro tem R$ 54,4 mil de crédito). Isso está certo, não é erro.

## Causa provável
Quando a importação do Sponte termina, ela pede para atualizar dados com um nome que nenhuma tela usa. Por isso o Fluxo Diário continua com os números antigos até a página ser recarregada.

## Correção
1. Abrir o Fluxo Diário de dezembro em Bairro Alto com um usuário de teste e confirmar que, recarregando, aparecem cerca de R$ 46,6 mil de Sponte mais R$ 3.932 de cheques.
2. Fazer a importação do Sponte atualizar as mesmas informações que o Fluxo Diário, o Dashboard e o Fluxo de Caixa usam, para os valores aparecerem logo depois de importar.
3. Conferir se as outras importações (cheques, cartões, contas a pagar) usam a atualização certa e corrigir as que estiverem com o nome errado.
4. Se, mesmo recarregando, dezembro continuar mostrando só R$ 3.932, investigar o cálculo do mês antes de mudar qualquer coisa.

## Detalhes técnicos
- `ImportacaoSponteAuditada.tsx` chama `invalidateQueries({ queryKey: ['entries-from-base'] })`, mas as consultas usam `['entries', schoolId, 'fromBase', …]`. Trocar para `['entries']`.
- Nenhuma mudança em regras de cálculo nem nos dados.
