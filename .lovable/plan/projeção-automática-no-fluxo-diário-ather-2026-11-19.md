# Projeção automática no fluxo diário (Ather)

Hoje a Ather não tem nenhum valor previsto daqui para frente: o fluxo diário mostra só o que já aconteceu no banco.

## Ideia: três camadas, da mais certa para a menos certa

1. **Contas fixas (recorrentes)**
   O sistema olha os últimos 6 meses do extrato e acha o que se repete todo mês com valor parecido e em dia parecido: aluguel, salários, contador, sistemas, impostos. Mostra uma lista para a equipe confirmar ("sim, é fixo") e ajustar valor e dia. Depois de confirmada, a conta entra sozinha nos próximos meses, no dia certo (fim de semana passa para sexta, como já é na Projeção).

2. **Recebimentos de contratos**
   Como na Ather a receita vem de obras e contratos, a equipe cadastra cada contrato com as parcelas (valor e data prevista). Isso também alimenta o indicador "Carteira de contratos a receber".

3. **Média dos variáveis**
   O que não é fixo nem contrato (material, combustível, pequenas despesas) entra como média dos últimos 3 meses de cada item do modelo, dividida pelos dias úteis do mês.

## Como fica na tela
- No fluxo diário, os valores previstos aparecem separados do realizado (como já acontece hoje com as projeções), com a marca de origem: "fixo", "contrato" ou "média".
- Quando o valor real cai no banco, a previsão daquele dia sai, sem contar em dobro.
- Uma tela simples para revisar as contas fixas e os contratos a qualquer momento.

## Ordem sugerida
- Começar pela camada 1 (contas fixas), que dá mais acerto com menos trabalho.
- Depois a 2 (contratos) e, se fizer sentido, a 3 (médias).

## Detalhes técnicos
- Regras novas de recorrência e de média em módulo puro e testado; as previsões são gravadas como lançamentos de projeção normais (com origem própria e rastreabilidade), lidos pelo projectionEngine/ledgerEngine existentes — nenhuma regra paralela de cálculo.
- Classificação sempre pelo item do modelo (SSOT), nunca pelo sinal do valor.
- A substituição previsão→realizado usa a mesma lógica que já existe para o dia em andamento e para os débitos futuros do extrato.
- Começa liberado só para a Ather (chave por empresa), podendo ser ligado para outras depois.
