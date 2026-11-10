# Proteção de destino de extratos

## Regra atual (instrução explícita da proprietária, 10/11/2026)
"Não quero que bloqueie o que já usamos hoje… só bloqueia se ver que tá errado."
Substitui a exigência anterior de identidade completa (fail-closed).

**Bloqueia** (sem botão "importar mesmo assim"):
- banco, agência, conta ou documento do titular **lidos do cabeçalho** que comprovadamente não conferem com o cadastro da conta escolhida — cada campo é comparado mesmo que os outros faltem;
- conta que não pertence à empresa selecionada, conta inativa/virtual ou usuário sem permissão (RLS, empresa restrita).

**Não bloqueia** (aviso simples na prévia, sem diálogo): identificação ausente, incompleta, ilegível ou ambígua; cadastro incompleto (caixa/manual) ou com banco desconhecido; dígito presente só de um lado; código de banco fora da lista conhecida; documento no arquivo sem titular cadastrado; titular específico inconsistente; cadastro duplicado de mesma conta. Nada disso grava `identity_checked=true`; a importação fica `identity_status='inconclusive'`.

Todos os formatos e rotinas anteriores continuam: OFX, CSV, Excel, PDF de texto, PDF com senha (senha pedida só pelo leitor do navegador, como antes), PDF por imagem (OCR), API e lançamentos manuais. Os controles anteriores de saldo/qualidade de leitura (`bloqueiaImportacao` quando a leitura não fecha com os saldos impressos) continuam valendo.

## Como compara
- Banco: código do arquivo (zeros à esquerda são formatação). Só prova divergência se o código do arquivo estiver na lista de bancos conhecidos (`KNOWN_BANK_CODES`, mesma lista na SQL).
- Agência/conta: só pontuação e zeros à esquerda são ignorados. Iguais = confere. Um número contido no outro (dígito faltando, prefixo de agência/operação) = inconclusivo. Números que não podem ser o mesmo = divergência.
- Titular: só rótulos explícitos (`CPF/CNPJ do titular`, tags CNPJ/CPF do bloco BANKACCTFROM do OFX). CNPJ genérico do cabeçalho (que pode ser do próprio banco) e documentos de pagadores no corpo são ignorados. Empresas multi-CNPJ: vale o `holder_entity_id` da própria conta, nunca qualquer CNPJ da empresa.
- OCR nunca prova divergência (pode trocar dígitos). Nome do arquivo e histórico nunca participam.

## Onde
- Regra compartilhada: `supabase/functions/_shared/bankIdentity.ts` (navegador + função).
- Função `bank-statement-import`: lê o cabeçalho de forma independente (`header.ts`; PDF pela 1ª página com leitor de texto; qualquer falha, senha ou imagem = inconclusivo). Identidade enviada pelo navegador nunca é prova.
- SQL `commit_verified_bank_import` (migration 0119): mesma regra, gravação atômica em lote, dedup, contagens reais, previsão, `bank_ref`; aceita `pdf`; marca `identity_status`. `bank_account_identity_shared` (só serviço) avisa cadastro duplicado. Cadastrar conta repetida não é mais impedido.
- Flag `bank_import_guard_enforced` (já ativa) apenas faz uploads passarem pelo servidor; não exige identidade.

## Verificação reproduzível (somente dados fictícios)
- `bash src/test/bankIdentity.integration.sh` — PostgreSQL descartável por socket local: 29 verificações de regra + 12 de lote + cadastro duplicado permitido + 3 de concorrência. Schema mínimo e predicados de autorização simulados.
- `deno test -A --node-modules-dir=auto supabase/functions/bank-statement-import/header_test.ts` — 5 testes do leitor do servidor com PDFs gerados no teste (texto, outra conta, imagem/corrompido, com senha via qpdf, CSV sem cabeçalho).
- Vitest focado (ambiente node): bankIdentity, bankAccountRegistration, bankTemplate, bankCashflow, bankAutoInvest, bankFuturos.

## Limites
- Não houve importação real pela tela com sessão autenticada; o leitor de PDF foi validado em Deno local, não no runtime publicado — se falhar lá, o resultado é inconclusivo (aviso), nunca bloqueio.
- A tela publicada antes desta revisão ainda aplica a regra antiga no navegador até a nova publicação.
