# Filtro Entradas/Saídas nas Pendências

Na tela Pendências, ao lado de "Todas as responsáveis" e "Qualquer idade", entra um novo seletor **"Entradas e saídas"**, com três opções:
- Entradas e saídas (padrão)
- Só entradas (receitas)
- Só saídas (despesas)

O filtro vale para tudo o que aparece na tela:
- os quatro cartões (quantidade, empresas, pendência mais antiga, valor pendente);
- a lista por responsável, por empresa e por dia;
- o **"Baixar Excel"** da equipe;
- o **"Excel para o cliente"**: com "Só saídas" escolhido, o cliente recebe só as despesas pendentes. O título da planilha passa a dizer "— só saídas" ou "— só entradas".

## Detalhes técnicos
- Só muda `ReconciliationBacklog.tsx`: novo estado `direction` ('all'|'entrada'|'saida') aplicado em `filtered` usando o campo `tipo` do lançamento bancário (o mesmo que a tela já usa para cor e sinal). Não mexe em cálculos financeiros.
