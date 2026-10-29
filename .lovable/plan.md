# Rondonópolis: Distribuição de lucros não aparece no painel

## O que encontrei
- No Fluxo Bancário, os lançamentos estão certos: 8 saídas de Outubro como "Operação · Distribuição de lucros" (R$ 71.981,29 no total).
- O painel ainda não lê o Fluxo Bancário da Rondonópolis. A ligação com o banco está em **"Em conferência"**, e o painel continua usando a **planilha**. A última alteração foi hoje, às 14:04.
- Por isso o painel mostra os cards da planilha (Receita Cartões, Sponte, Cheques, Contas a pagar) e não mostra o que foi classificado no banco. Isso vale para a Distribuição de lucros e para as outras classificações.
- Em Outubro ainda faltam classificar 5 lançamentos ("A classificar"): 4 conciliados (R$ 4.026,12) e 1 pendente (R$ 1.649,03).

Quando o banco passar a ser a fonte do painel, a Distribuição de lucros vai aparecer em **"Operações financeiras"** como saída. Ela vai mexer só no caixa e não vai entrar no Resultado, como manda a regra das operações.

## O que fazer
1. Mostrar à equipe quais são os 5 lançamentos "A classificar" de Outubro, para serem classificados.
2. Ativar o Fluxo Bancário como fonte do painel da Rondonópolis a partir de 09/2026, que é o mês de início já configurado. Isso pode ser feito pelo botão de ativação na tela de Fontes de dados ou por mim, depois da sua confirmação.
3. Conferir no painel de Out/2026 que:
   - aparece "Operações financeiras", com Distribuição de lucros de R$ 71.981,29;
   - o saldo inicial e o resultado batem com o banco (hoje mostram R$ 0,00 porque ainda vêm da planilha).
4. Melhoria opcional: quando a empresa estiver "Em conferência", mostrar no painel o aviso "Painel ainda usa a planilha — Fluxo Bancário em conferência", para essa dúvida não voltar.

## Detalhes técnicos
- `withCashflowSource` (useFinancialData) só aplica o overlay quando `school_data_sources.status='ativo'` e `dashboard_source='fluxo_caixa'`. Hoje a Rondonópolis está com `status=em_conferencia` e `dashboard_source=planilha`.
- Nenhuma regra de cálculo muda: o overlay já transforma o item em `Operação (banco): Distribuição de lucros`, e o ledgerEngine trata como só Caixa.
