# Hubla da Go Company ainda lendo 2 lançamentos

Você não fez nada errado. A correção está na versão de testes, mas o endereço que a equipe usa (relatorioscontamuito.online) só recebe mudanças depois de publicar — e essa correção provavelmente ainda não foi publicada. Antes de publicar, quero confirmar que ela funciona com o PDF de verdade, e não só com o teste.

## Passos
1. Abrir a versão de testes, entrar como administradora, ir na Go Company → Fluxo Bancário → importar o PDF "Contas & Extratos" que você mandou, e conferir se a tela de conferência mostra 24 lançamentos (entradas e saídas de R$ 8.194,70, saldo final R$ 0,00).
2. Se mostrar menos que 24: comparar como o navegador lê as linhas do PDF com as linhas usadas no teste, ajustar o reconhecimento desse formato do Nibo e repetir o passo 1 até fechar.
3. Não gravar nada na Go Company durante o teste (só a tela de conferência).
4. Pedir para você publicar; depois disso basta reenviar o PDF — as 2 linhas já importadas não se repetem.

## Detalhes técnicos
- `parseBankFile` já chama `isNiboContasPdf` → `parseNiboContasPdfLines`, mas depois de `isBradescoPdf`; checar se o PDF real não cai antes em outro parser ou se `readPdfLines` no navegador agrupa as linhas diferente da fixture `niboHublaGo.json`.
- Validação via Playwright com upload do arquivo `Contas_Extratos_GO_COMPANY_LTDA.pdf`.
