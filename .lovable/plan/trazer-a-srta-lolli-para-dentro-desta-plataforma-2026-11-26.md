# Trazer a Srta Lolli para dentro desta plataforma

## Como está hoje
O Srta Lolli é um projeto separado, com banco de dados próprio (vendas, pedidos do Olist, taxas de maquininha/gateway, fretes, impostos, marketing, despesas, fluxo de caixa, folha, chargebacks) e telas próprias (Dashboard, Resumo, DRE, Balancete, Fluxo de Caixa, Operação, Fretes, Marketing, Produtos, Importações). Os dois projetos não enxergam os dados um do outro. Não existe botão de "juntar projetos": a vinculação é uma migração feita com cuidado.

## Caminho recomendado (igual ao que fizemos com a Quintal de Casa)
A Srta Lolli vira uma empresa aqui dentro, com as telas exclusivas dela, sem mudar nada nas outras empresas. O projeto antigo continua no ar e intacto até você aprovar a troca, então nada se perde.

1. **Cadastro:** criar a empresa Srta Lolli (restrita ou visível à equipe, como você preferir) e as carteiras/acessos.
2. **Estrutura:** criar aqui as tabelas que só a Lolli usa (vendas, pedidos ignorados, taxas por período, fretes da transportadora, impostos/fretes/taxas manuais, marketing, custos de produto), todas ligadas à empresa e protegidas como as demais.
3. **Telas:** trazer as telas da Lolli como telas exclusivas, abertas só quando a empresa selecionada for a Lolli. Despesas, fluxo bancário e conciliação passam a usar os módulos que já existem aqui, seguindo a regra única de cálculo.
4. **Integração Olist:** reaproveitar a integração Olist que já existe nesta plataforma; será preciso reconectar a conta da Lolli uma vez (a senha/token não pode ser copiado entre projetos).
5. **Dados:** este chat não consegue ler o banco do outro projeto. Você abre o chat do Srta Lolli e pede a exportação em CSV de cada tabela; envia os arquivos aqui e eu importo, com rastreabilidade de origem.
6. **Conferência:** comparar totais por mês (vendas, despesas, saldo, DRE) entre o projeto antigo e o novo. Só depois disso a equipe passa a usar o daqui; o antigo fica como consulta.

## O que não se perde
- Nenhum dado é apagado no projeto antigo.
- Configurações (modelos de importação, grupos de despesa, regras de fluxo, taxas) vêm junto nos CSVs.
- Usuários precisam de acesso criado aqui (logins não migram automaticamente).

## Alternativa mais simples
Se a ideia for só abrir a Lolli a partir daqui, posso colocar um atalho para o endereço dela (style-metrics-suite.lovable.app), sem migrar nada. Os dados continuam separados.

## Detalhes técnicos
- Padrão `isQuintal()` → `isLolli()` com arquivos `*.lolli.tsx` e invólucro com `key`; regra registrada no AGENTS.md.
- Tabelas novas com `school_id`, RLS `user_has_school_access` + RESTRICTIVE `can_see_school`.
- A Lolli usa TanStack Start (rotas server); as funções de servidor viram Edge Functions aqui (sync Olist, aprovação automática de pedidos após importar extrato).
- Ordem: estrutura → telas → importação CSV → conferência de totais → troca.
