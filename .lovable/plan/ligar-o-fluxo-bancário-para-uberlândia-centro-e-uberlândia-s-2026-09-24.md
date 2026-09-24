# Ligar o Fluxo Bancário para Uberlândia Centro e Uberlândia Santa Mônica

## O que muda
- **Onde aparece:** a aba "Fluxo Bancário" passa a aparecer também em Uberlândia Centro e Uberlândia Santa Mônica. Como na Dourados, só administradores veem a aba; os clientes continuam vendo tudo igual.
- **Funções:** as mesmas da Dourados.
  - Conciliação
  - Aplicação automática
  - Operação e Ignorar
  - Dividir valor
  - Transferências entre contas, com par automático
  - Histórico
- **Começa vazio:** cada empresa começa sem contas e sem extratos. Nada da Dourados é copiado, porque os dados ficam separados por empresa.
- **Próximos passos com vocês:**
  - Em cada empresa, abrir Fluxo Bancário → Contas e Extratos e cadastrar as contas bancárias. Para cada conta, informar o saldo inicial na data de corte e se tem aplicação automática.
  - Cadastrar em "Nomes da própria empresa" a razão social que aparece nas transferências entre contas. Se me passarem os nomes, eu cadastro.
  - Importar os extratos.

## Detalhes técnicos
- Ajuste de dados, sem mudança de código ou de estrutura do banco. Em `school_features`, liga `cashflow_bank_pilot` = true para:
  - `ac69fe70-e437-496d-a475-0e69c2917ad4` (Uberlândia Centro)
  - `cc50b7b2-fecf-42e6-8d67-569e4d2419b2` (Uberlândia Santa Mônica)
- Depois do ajuste, uma leitura confirma que as três empresas estão com o piloto ligado.
