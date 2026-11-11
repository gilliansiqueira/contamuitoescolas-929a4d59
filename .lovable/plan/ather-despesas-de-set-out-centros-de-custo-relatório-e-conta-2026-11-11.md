# Ather: despesas de set/out, centros de custo, relatório e Conta Azul

## Como já vinha sendo feito
- **Despesas (Relatório Realizado):** de fev a set/2026, um arquivo do Conta Azul por mês, com uma linha por categoria. O último vai até 11/09.
- **Centro de custo:** fica na Análise de Despesas detalhada, com um grupo por obra (ex.: "RS - SENAC Porto Alegre", "Veículos", "Sem centro de custos"). São cerca de 30 obras, lançadas em 26/10.

## As planilhas enviadas bastam?
Sim. Elas trazem fornecedor, descrição, categoria, data de pagamento, valor pago, juros e descontos, situação e até 5 centros de custo com o valor de cada um (o rateio).
- Os dois arquivos de resumo (pivot) só têm porcentagens. Vou usá-los apenas para conferir os totais.
- Os arquivos também incluem parcelas antigas que ainda estão em aberto ("Atrasado"). Só entram as que foram **pagas** em setembro ou outubro, pela data de pagamento.

## 1. Lançar setembro e outubro (dados, sem mudar telas)
- Substituir setembro a partir de 01/09, porque o arquivo antigo cobre só até 11/09. Em seguida, lançar outubro. Cada lançamento guarda o nome do arquivo de origem.
- Aporte e Transferências entre Contas são classificados como Operação. Assim, não entram na despesa nem no resultado.
- Centros de custo: lançar o valor de cada obra **com o rateio**. Um pagamento dividido entre 3 obras gera 3 partes, e a soma delas bate com o total pago. Pagamento sem centro de custo vai para "Sem centro de custos".
- Conferência antes de gravar: o total por categoria deve bater com o pivot, e a soma das obras deve bater com o total pago. Vou listar as linhas que causarem alguma diferença.

## 2. Relatório da Ather (novas análises)
- **Resultado por obra:** despesa do mês e acumulada de cada obra, com a participação de cada uma no total. Quando houver receita marcada por obra, mostra também a margem.
- **Ranking de obras e fornecedores:** as 10 obras e os 10 fornecedores com mais gasto no mês, com a variação em relação ao mês anterior.
- **Evolução mensal:** categorias principais (Materiais, Mão de obra terceirizada, Salários, Locação de equipamentos) de fev até o mês atual.
- **Custo da obra x estrutura:** quanto é gasto direto nas obras e quanto é da "ATHER ENGENHARIA" (administrativo e veículos).
- **Contas em atraso:** valor e quantidade de contas em aberto, que hoje somam 80 linhas em outubro.
- Essas páginas aparecem só para a Ather. As demais empresas continuam iguais.

## 3. Conta Azul (ler e enviar, como na WNC)
- Conexão pelo login da conta Conta Azul (OAuth), com as chaves guardadas de forma protegida. Vou precisar que você crie o aplicativo no portal de desenvolvedores do Conta Azul. Vou te passar o passo a passo e a URL de retorno.
- **Ler:** contas pagas, com categoria e centros de custo (com rateio), entram automaticamente no Realizado e nas obras, sem duplicar.
- **Enviar:** lançamentos do extrato que ainda não existirem no Conta Azul são enviados para lá, como a Olist faz na WNC, com categoria sugerida pelo histórico ou marcada como pendente.
- Os botões "Ler agora" e "Enviar agora" ficam com prévia antes de gravar. A rotina automática só é ligada depois de testarmos com você.

## Ordem
1. Lançar set/out e conferir os totais com você.
2. Novas páginas do relatório.
3. Conta Azul, que depende de você criar o aplicativo e me passar as chaves.

## Detalhes técnicos
- Realizado: `realized_entries`, com `origem_arquivo`. A substituição a partir de 01/09 vale só para os arquivos da Ather.
- Rateio: `expense_detail_items` por `expense_detail_groups` (obra), com `origem_upload_id`, `source_file` e `imported_at`. A data usada é a do último pagamento.
- Classificação continua pela SSOT (`classificationUtils`/`tipoMeta`), nunca pelo sinal.
- Nova Edge Function `contaazul-sync`, no mesmo padrão de `olist-sync`: credenciais em `erp_connections` (`*_enc`), deduplicação por id do Conta Azul e `erp_push_log` para o envio. Regras puras ficam testadas. Uma linha nova no AGENTS.md.
