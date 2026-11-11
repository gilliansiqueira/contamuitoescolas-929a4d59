# Extrato Sicredi de Londrina e relatório da Joinville no WhatsApp

## 1. Sicredi Londrina Dom Bosco (não é o mesmo problema do Bradesco)
O extrato está certo. O que está errado é o número da conta salvo na Londrina.
- Arquivo: Sicredi, cooperativa 0718, conta **57340-8**.
- Salvo em Londrina Dom Bosco: conta **570340-8**, com um "0" a mais no meio.
- Essa mesma conta 57340-8 também está salva na Manaus Laranjeiras, mas lá a conta está desativada. Pode ser uma cópia feita por engano.

O que vou fazer:
- Corrigir a conta da Londrina para 57340-8. Os lançamentos já importados não mudam.
- Ler o extrato de novo contra o cadastro corrigido para confirmar que ele passa sem bloqueio.
- Não vou mexer na conta desativada da Manaus. Se ela também estiver errada, você me avisa.

## 2. Relatório da Joinville "vertical" no WhatsApp
Conferi o PDF que você me mandou: todas as páginas já estão deitadas (paisagem) e não têm nenhuma rotação. O arquivo está certo. É o WhatsApp no celular que abre o documento na tela em pé e mostra a página deitada, pequena. Girar o celular resolve.
Não vou mudar o PDF. Se você preferir mandar o relatório como fotos, uma imagem por página, posso criar depois um botão "Baixar como imagens".

## Detalhes técnicos
- Mudança só de dados: `bank_accounts` id 3b240321… (Londrina) com `conta` = '57340-8'. Nenhuma mudança na regra de identidade, porque a conta 57340-8 bate com o ACCTID 7180000000573408.
- PDF: MediaBox 960×540 e /Rotate 0. Nenhuma mudança no código.
