# Roadmap

- [x] Consolidar dados financeiros, despesas, indicadores, conversão e matrículas no relatório geral
- [x] Aplicar a identidade visual Conta Muito ao PDF executivo e anexos
- [x] Integrar a exportação ao período selecionado
- [x] Validar cálculos, geração, paginação e todas as páginas do PDF
- [x] Carregar telas e relatórios pesados somente quando forem abertos
- [x] Evitar atualizações e leituras repetidas durante a navegação
- [x] Reduzir os dados buscados ao período selecionado sem alterar a SSOT
- [x] Validar desempenho e igualdade dos resultados financeiros
- [x] Conciliar despesas oficiais e detalhadas no relatório geral
- [x] Redesenhar o relatório geral em apresentação 16:9 Conta Muito
- [ ] Validar o PDF final em Dourados e em uma segunda empresa — bloqueado por falta de sessão autorizada para gerar os PDFs reais
- [x] Comparar anos no mesmo gráfico e ampliar indicadores no PDF
- [x] Substituir anexos tabulares pelo detalhamento visual de despesas
- [x] Replicar no PDF a análise de despesas por categoria e categoria-mãe
- [x] Exibir matrículas e contatos como quantidades, sem formato monetário
- [x] Criar e aprovar três direções visuais para acesso, área interna e ícone do app

- [x] Renovar somente a aparência do acesso, navegação e ícone; preservar integralmente dados, gráficos, páginas e cálculos atuais
- [x] Reproduzir a referência final da página de acesso com indicadores ilustrativos em movimento
- [x] Corrigir resumo, operações, séries anuais e totais Jan–mês do PDF geral
- [ ] Validar os valores finais do PDF de Dourados/agosto de 2026 e de uma segunda empresa — bloqueado por falta de sessão autorizada

## Operações de caixa (set/2026)
- [x] Contas a Pagar/Sponte/Cheque/Cartão: categorias exatas de Operação saem de Despesa e entram só no Caixa
- [ ] Validar PDFs reais com login de administrador (bloqueado: sessão)
- [ ] Decidir: Manaus Laranjeiras ago/2026 Distribuição de Lucros 100.000 no histórico x 50.000 no extrato
- [ ] Decidir: nomes sem regra (ex.: "Parcela do Empréstimo", "8.01 Pagamento de Empréstimo Bancário", "Aporte") seguem como despesa
- [x] Fazer o PDF espelhar os mesmos itens, sentidos e totais de Operações Financeiras do Dashboard

## Piloto Fluxo Bancário — Dourados (set/2026)
- [x] Tabelas novas, acesso só de administradores, opção do piloto ligada só na Dourados
- [x] Aba "Fluxo Bancário" (admin + piloto): Resumo, Movimentações/conciliação, Contas e Extratos
- [x] Leitura de OFX, CSV, Excel e PDF, com conferência e proteção contra duplicidade
- [ ] Validar com extratos reais da Dourados (aguardando arquivos e saldos das contas)
- [ ] Fase 2 (nova aprovação): extratos alimentando Dashboard e Fluxo Diário

## Fluxo Bancário: aplicação automática (set/2026)
- [x] Dois saldos por conta (em conta + aplicado), aplicações fora de entradas/saídas, detecção por descrição, conferência com o banco
- [ ] Confirmar saldos iniciais da conta BB de Dourados (extrato indica saldo em conta 0,00 em 31/08; usuária informou 599,00) — aguardando usuária
