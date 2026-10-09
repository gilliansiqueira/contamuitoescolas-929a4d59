# Joinville – extratos do Santander

## O que encontrei
- **O arquivo é lido certinho.** São 358 lançamentos de 01/09 a 09/10, e a soma bate com o saldo do banco: R$ 5.514,97 em conta.
- **O que trava é o aviso** "O modelo da empresa não possui o tipo padrão de Receita/Despesa". Ele aparece quando a empresa não tem modelo financeiro escolhido. Sem modelo, o sistema não sabe onde colocar Receita e Despesa e recusa a gravação.
  - **Joinville Centro** está sem modelo hoje.
  - **Joinville Norte** está hoje com o modelo "Escola", que tem Receita e Despesa. O modelo pode ter sido escolhido depois do print, mas isso não fica registrado. Vou testar a importação de novo.
- **A aplicação ContaMax do Santander** funciona como aplicação automática: o banco zera a conta todo dia ("Aplicacao Contamax" e "Resgate Contamax Automatico").
  - A conta Santander está cadastrada sem aplicação automática. Se importar assim, essas linhas entram como entradas e saídas comuns.
  - Com isso, o saldo aplicado não aparece. Segundo o PDF, o aplicado é **R$ 23.633,37**.

## O que vou fazer
1. **Contas Santander (Norte e Centro):** marcar "Aplicação automática" e cadastrar "contamax" nas descrições de aplicação automática. Assim, aplicação e resgate mexem só na divisão entre "em conta" e "aplicado", e não contam como receita ou despesa.
   - **Aplicado inicial de Norte em 31/08:** cerca de **R$ 40.941,39**. Calculei esse valor voltando do saldo do PDF pelas aplicações e resgates. O valor é aproximado, porque os rendimentos do ContaMax não aparecem no extrato.
2. **Importar o OFX de Norte pela tela**, com o acesso de quem cuida de Joinville.
   - Antes de gravar, confiro a prévia: 358 linhas novas, 27 delas marcadas como aplicação automática.
   - Depois informo o aplicado do PDF. O saldo de 09/10 fica **R$ 5.514,97 em conta + R$ 23.633,37 aplicado**.
3. **Joinville Centro:** escolher o modelo financeiro. Depois, você manda o extrato de Centro (OFX ou PDF) e eu importo do mesmo jeito.
4. **Aviso mais claro:** quando a empresa estiver sem modelo financeiro, o sistema vai avisar na hora de abrir o arquivo, já dizendo onde escolher o modelo. Hoje a mensagem só aparece ao confirmar e não explica o que fazer.

## Preciso confirmar
- Joinville Centro pode usar o mesmo modelo de Norte ("Escola")?
- Você tem o saldo do ContaMax de Norte em 31/08? Se não tiver, uso o valor aproximado de R$ 40.941,39. Esse valor só afeta os saldos diários de setembro. O saldo atual sai do PDF.

## Detalhes técnicos
- O erro vem do gatilho `apply_bank_default_model_item`: sem `schools.financial_model_template_id`, não há item Receita/Despesa.
- Dados:
  - `bank_accounts.has_auto_invest=true` e `auto_invest_saldo_inicial` nas contas `f8b15eac…` (Norte) e `37ecf0a0…` (Centro);
  - `bank_auto_invest_patterns` "contamax" nas duas empresas;
  - `schools.financial_model_template_id` de Centro, após confirmação;
  - depois da importação, `saldo_aplicado_informado` = 29.148,34 (total) no import de Norte, via o botão de aplicado já existente.
- Código: em `BankAccountsImports.onFile`, conferir se a empresa tem modelo antes da prévia e mostrar a mensagem com o caminho para escolher. Nenhuma regra financeira muda.
