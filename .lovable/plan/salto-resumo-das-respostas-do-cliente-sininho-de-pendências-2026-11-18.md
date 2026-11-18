# Salto: resumo das respostas do cliente + sininho de pendências

## 1. Resumo para lançar e conciliar (já levantado)
O cliente respondeu as 14 saídas pendentes (R$ 9.861,69):

| Data | Descrição no banco | Valor | Resposta do cliente |
|---|---|---|---|
| 13/10 | Salto Limp | 128,80 | Material de Limpeza |
| 21/10 | Postos Pelanda | 198,57 | Treinamento e Recrutamento (combustível – Convenção) |
| 26/10 | PIX 99 Food | 95,32 | Treinamento e Recrutamento (alimentação – Convenção) |
| 26/10 | Rede Fukami Curitiba | 90,81 | Treinamento e Recrutamento (combustível – Convenção) |
| 26/10 | Petropen Pariquera-Açu | 94,24 | Treinamento e Recrutamento (combustível – Convenção) |
| 30/10 | Supermercado São Vicente | 298,57 | Atividade Extra |
| 30/10 | Papelaria Padovani | 56,90 | Atividade Extra |
| 04/11 | PIX Papelaria Rui Barbosa | 8,25 | Material de escritório |
| 04/11 | Carrefour Posto | 182,31 | Combustível |
| 06/11 | PIX Samuel Santana Araújo | 552,00 | Salário de outubro/2026 (holerite já enviado) |
| 06/11 | Supermercado Pagu | 158,92 | Copa – consumo (café) |
| 10/11 | Carrefour Posto | 184,40 | Combustível |
| 11/11 | Transf. Luciana Guscikem | 1.452,60 | Transferência para o cofre, usada para pagar um professor |
| 16/11 | Transf. Luciana Guscikem | 6.360,00 | Pagamento do cartão Santander (junto com os 5 mil do mesmo dia) |

Atenção: as duas transferências para a Luciana pedem conferência (o professor pago pelo cofre e a fatura do Santander) antes de conciliar. Esse resumo vai pronto no chat após a aprovação, para você copiar.

## 2. Sininho de pendências para o cliente (padrão para todas as empresas com a tela liberada)
- Sininho no topo da tela do cliente com um número: quantas saídas pendentes ainda estão sem resposta.
- Ao clicar, abre direto a tela "Pendências".
- "Pendências" sai de dentro de "Visão Geral" e vira item próprio e visível no menu, com o mesmo número.
- Sem pendências sem resposta: sininho sem número.
- Só aparece para empresas com a tela de pendências liberada (hoje, Salto). Não altera nenhum valor nem conciliação.

## Detalhes técnicos
- Contagem vem da RPC existente `client_pending_outflows` (filtrar sem `categoria_texto`) via react-query, compartilhada entre o sininho e o menu.
- Novo `ClientPendingBell` no cabeçalho de `src/pages/Index.tsx`, só quando `clientPendingEnabled`; clique faz `setActiveTab('client_pending')`.
- Menu: `client_pending` como item de topo (fora do grupo recolhido "Visão Geral") com badge.
- Contagem pura em `src/lib/clientPending.ts` + teste.
