# Pinheirinho: PDF da Caixa bloqueado por diferença falsa em 30/09

## O erro (confirmado)
- A leitura das 6 linhas está certa. R$ 1.127,61 + R$ 10.259,71 - R$ 11.035,30 = **R$ 352,02**, o mesmo saldo final do banco.
- Em 30/09 entram dois lançamentos:
  - 02:49: DÉBITO PRESTAÇÃO HAB de R$ 10.259,71. Logo depois desse débito, o saldo fica em -R$ 9.907,69.
  - 10:34: CRED PIX de R$ 10.259,71. Depois desse crédito, o saldo volta para R$ 352,02.
- Neste envio, a leitura da imagem não pegou a linha "SALDO DIA" de 30/09. Quando falta essa linha, o sistema usa o saldo impresso ao lado de um lançamento para conferir o dia.
- O sistema pegou o saldo do **primeiro** lançamento do dia (-R$ 9.907,69), quando deveria pegar o do **último** (R$ 352,02).
- A diferença entre os dois é exatamente R$ 10.259,71. Por isso o aviso aparece e o botão fica bloqueado.

## Correção
1. Quando faltar o "SALDO DIA", o sistema passa a conferir o dia pelo saldo do **último lançamento do dia**, pelo horário. A trava continua valendo para diferenças reais.
2. Criar um teste automático com este caso: o débito e o crédito do mesmo dia, sem "SALDO DIA" em 30/09. O teste deve aceitar o arquivo com 6 lançamentos e saldo final de R$ 352,02.
3. Publicar. Depois, a equipe reenvia o mesmo PDF e o botão deve liberar. Vale para todas as empresas com Caixa.

## Detalhes técnicos
- `parsers.ts`, `parseCaixaImageText`: hoje o fechamento sem SALDO DIA usa `fechamento.set(r.data, r.saldoLinha)` na primeira linha ordenada por horário. A correção é sobrescrever pelo saldo da linha de maior horário de cada dia.
- Novo caso em `bankCaixaImagePdf.test.ts`, usando a fixture sem a linha SALDO DIA de 30/09.
