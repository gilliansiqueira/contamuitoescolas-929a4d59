# Cuiabá Goiabeiras: diferença que trava a aprovação

## O que a tela mostra
- Banco do Brasil: diferença de R$ 0,04 em 28/09.
- Sicredi: diferença de R$ 9,67 em 28/09.
- Stone: confere.
- Somando tudo, a diferença é de R$ 9,71. É bem provável que seja rendimento das aplicações, que o banco credita sem mostrar como uma linha do extrato, ou arredondamento de centavos.

## Por que ainda trava
A regra "diferenças de até R$ 10,00 ficam em 'a confirmar no próximo extrato' e não bloqueiam" foi criada para São Carlos. Ela ainda está só na prévia e não foi para o site oficial. Por isso, no site oficial, qualquer centavo de diferença continua bloqueando o botão.

## O que vou fazer
1. Abrir a prévia de ativação de Cuiabá Goiabeiras. Vou confirmar que o único bloqueio é essa diferença, e não um saldo inicial diferente ou lançamentos "a classificar".
2. Conferir no extrato do Sicredi e do BB se os R$ 9,67 e os R$ 0,04 são mesmo rendimento. Para isso, vou comparar o saldo aplicado que o banco informa com o valor que o sistema calcula.
3. Se for só isso, o botão "Aprovar e ativar" libera na prévia e aparece o aviso amarelo "a confirmar no próximo extrato". Os lançamentos não mudam.
4. Importar o OFX da Stone que você mandou ("Comprovante_de_Extrato_2.ofx"). Ele vai até 28/09 e o resultado deve continuar batendo.
5. A regra dos R$ 10 vale para todas as empresas, não só para São Carlos e Cuiabá. Vou conferir que nenhuma empresa tem limite próprio diferente. A regra é somada por empresa: se a soma das contas passar de R$ 10, a aprovação continua travada.
6. Pedir sua autorização para publicar no site oficial. Isso inclui a regra de R$ 10 e as outras mudanças que estão esperando.

## Detalhes técnicos
- ActivationPreview.tsx: `ok = movOk && iniDiff === 0 && (fimOk || fimSmall) && aClass.length === 0`, com `SMALL_DIFF_TOLERANCE = 10`, que só existe na prévia.
- Se o bloqueio for `iniDiff` ou `aClass`, corrigir o saldo de 31/08 ou a classificação. Isso sempre passa por conferência com o PDF e fica registrado no audit_log.
