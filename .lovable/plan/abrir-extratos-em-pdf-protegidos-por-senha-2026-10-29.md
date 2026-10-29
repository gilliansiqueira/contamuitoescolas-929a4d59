# Abrir extratos em PDF protegidos por senha

## O que acontece hoje
O extrato do C6 (NC Construções, set/2026) tem senha. O sistema tenta abrir o PDF sem senha e mostra "No password given". Testei a senha 575329: ela abre o arquivo, e o texto sai normal (2 saídas: R$ 6,90 em 04/09 e R$ 20,00 em 25/09; saldo final R$ 47,42).

## O que muda
- Quando o PDF tiver senha, aparece uma janela pedindo **"Senha do PDF"**. Se a senha estiver errada, aparece "Senha incorreta" e dá para tentar de novo.
- Depois de abrir, a leitura segue igual a hoje: conferência com os saldos impressos, tirar duplicados e registrar de onde veio cada lançamento.
- A senha não fica salva em lugar nenhum. Ela é usada só para abrir o arquivo no navegador.
- Mensagens técnicas em inglês viram explicações em português.
- O mesmo vale para o envio de PDF em Upload de Dados e no cartão de ponto.

## Depois de publicar
Enviar o extrato de novo na conta Banco C6 da Obras Nascimento e digitar 575329 quando a janela pedir.

## Detalhes técnicos
- `src/lib/bankStatements/parsers.ts` (linhas 1016/1037): `getDocument({ data, password })`. Capturar `PasswordException` (código 1 = precisa de senha, 2 = senha incorreta) e chamar o callback `requestPassword` vindo do componente de importação.
- Criar o diálogo de senha (shadcn Dialog) no componente de importação do Fluxo Bancário. Aplicar o mesmo tratamento em `FileUpload.tsx:291` e `cartaoPontoParser.ts:158`.
- Criar um teste com um PDF de exemplo protegido por senha: sem senha deve falhar com o código certo, e com a senha deve abrir.
- Conferir se o parser do C6 lê esse layout ("Saldo contábil do dia"). Se não ler, ajustar o parser do C6.
