# Bradesco em todos os clientes + Relatório geral da Jurassic

## 1. Erro no extrato Bradesco (todos os clientes e Boa Vista)

**O que conferi**
- Testei a conferência de conta da versão atual com os dois OFX Bradesco que você mandou (SJP e Agência One), comparando com as 8 contas Bradesco cadastradas. Cada arquivo foi aceito só na conta certa e barrado nas outras, como deveria.
- O Bradesco manda no OFX a conta sem o dígito e sem zeros (ex.: 50077 para 0050077-1). Na versão atual, isso gera só um aviso, sem bloquear.
- Boa Vista: a conta Bradesco é 6566 / 00068942. O último extrato Bradesco que entrou foi em 04/11. Os extratos Asaas e Itaú continuam entrando normalmente.

**Causa provável (ainda não confirmada)**
- A versão publicada pode ser a anterior, que bloqueava conta sem dígito, ou estar sem a correção de duplicidade feita hoje. Também é possível que algum Bradesco mande o número da conta num formato diferente (ex.: com a agência junto).

**O que vou fazer**
1. Baixar o extrato da Boa Vista de 04/11, que já está salvo no sistema, e reproduzir a conferência com ele e com um OFX de outros clientes Bradesco. A comparação passa a aceitar como mesma conta os formatos que o Bradesco usa: sem dígito, sem zeros e com a agência na frente. Contas realmente diferentes continuam bloqueadas.
2. Criar um teste fixo com esses formatos do Bradesco, para nunca mais voltar a bloquear.
3. Fazer o servidor seguir a mesma regra.
4. Depois disso, você publica a versão nova. As duas correções de hoje (duplicidade e Agência One) só passam a valer depois de publicar.

## 2. Relatório geral (PDF) com Recebimento por categoria e Produtos mais vendidos

- A Jurassic já tem esses dados preenchidos: 124 valores de categorias e 32 meses de produtos.
- Vou acrescentar duas seções ao Relatório geral, usando o mês do período escolhido:
  - **Recebimento por categoria:** tabela com cada categoria e o valor, mais o total.
  - **Produtos mais vendidos:** as duas listas (por valor e por quantidade), como aparecem na tela.
- As seções só aparecem para as empresas que têm esses dados, e nada muda nos números financeiros.
- O texto de confirmação do botão passa a citar essas seções.

## Detalhes técnicos
- Identidade: ajustar `compareNumber` em `_shared/bankIdentity.ts` e `bank_identity_cmp_num` (migration nova) para tratar o sufixo de dígito, o prefixo de agência e os zeros como "incerto/mesma conta". Fixtures em `src/test/bankIdentity.test.ts`. Redeploy da função `bank-statement-import`.
- PDF: `pdf/mesCompletoPdf.ts` recebe `recebimentoCategoria` e `produtosMaisVendidos` em `MesCompletoData`, preenchidos com os mesmos dados das telas `RecebimentoCategoria` e `ProdutosMaisVendidos` (`useProductSales`), sem recalcular nada.
