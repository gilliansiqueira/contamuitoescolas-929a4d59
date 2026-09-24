# Transferências entre contas: mais nomes, marcação manual e "par" automático

## O que foi visto nos dados da Dourados
- Na Stone, os envios aparecem como "PEGORER IDIOMAS LTDA - Transferência" e já foram reconhecidos.
- Do outro lado, no Inter e no Sicredi, o mesmo dinheiro chega como "INFLUX DOURADOS". Essas linhas continuam como Entrada, o que infla as Entradas realizadas.
- **Cuidado:** usar só "Influx" também pegaria os boletos da franqueadora ("INFLUX HOLDING E FRANQUIAS", "HOLDING INFLUX", "METODO INFLUX"). Esses boletos são despesa de verdade. Por isso o nome a cadastrar é **"influx dourados"**.

## O que muda
1. **Cadastrar "influx dourados"** nos nomes da própria empresa da Dourados. Depois, a seção mostra o botão "Marcar N lançamentos já importados" para você aplicar nos extratos que já estão na plataforma.
2. **As meninas podem marcar à mão, de três jeitos:**
   - Coluna Categoria → "Transferência entre contas". Isso já existe hoje.
   - Novo botão em lote "Marcar como transferência" para as linhas selecionadas, e "Tirar de transferência" para desfazer.
   - Ao marcar uma linha à mão, aparece a pergunta "Lembrar este nome para os próximos extratos?". O campo já vem preenchido com o nome tirado da descrição e pode ser editado antes de salvar.
3. **Par automático:** quando uma linha é marcada como transferência, a plataforma procura a "outra ponta". Ela precisa ter o mesmo valor, sentido oposto, estar em outra conta e ter até 2 dias de diferença. Se achar, marca as duas e mostra "Transferência Stone → Inter". O mesmo vale na importação: um extrato novo que tem a outra ponta de uma transferência já marcada entra marcado.
4. **Transferências sugeridas:** a lista que já existe passa a incluir também as linhas marcadas sem par, para confirmar com um clique.
5. Tudo continua com "Desfazer" e histórico por linha. O saldo de cada conta não muda.

## Detalhes técnicos
- **Dados:** inserir `'influx dourados'` em `bank_own_transfer_names` para a escola `08d994fd-...`.
- **`BankTransactionsTable.tsx`:**
  - botões em lote para `transferencia` e `normal`;
  - diálogo "Lembrar nome" com sugestão extraída da descrição: texto depois de "Cp :NNNN-", ou o nome em maiúsculas, sem CNPJ e sem "Pix recebido/enviado". A sugestão insere em `bank_own_transfer_names`.
- **`bankCashflowEngine.ts`:**
  - `findTransferCounterpart(tx, txs)`, com as mesmas regras de `suggestTransferPairs`;
  - `suggestTransferPairs` passa a aceitar linhas `transferencia` sem `transfer_pair_id`.
- **Ao marcar uma linha:**
  - com contraparte encontrada, grava `movement_kind='transferencia'` nas duas e o mesmo `transfer_pair_id`;
  - sem contraparte, grava só `movement_kind`.
- **`BankAccountsImports.tsx`:** na importação, uma linha nova que é contraparte de uma transferência já existente sem par entra como `transferencia`, e o par é gravado depois da inserção.
- **Resumo:** o `summarize` não conta duas vezes. Quem tem par segue a regra atual (divide por 2); quem não tem par conta uma vez.
- **Testes:**
  - "influx dourados" não reconhece "INFLUX HOLDING";
  - uma contraparte é encontrada e pareada;
  - Entradas realizadas caem após o pareamento.
