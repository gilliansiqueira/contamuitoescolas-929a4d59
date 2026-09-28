# Justificativa obrigatória nas pendências de conciliação (a partir de 01/10/2026)

## Regra
- Setembro não muda: as pendências desse mês não pedem justificativa e não travam nada.
- A partir de 01/10/2026, todo lançamento de extrato que continuar **Pendente** precisa ter um motivo da lista padrão. A observação é opcional.

## 1. Lista de motivos (Configurações, só super admin)
- Tela "Motivos de justificativa" no mesmo formato da imagem: campo com botão Adicionar e tabela com Nome, Status (Ativo/Inativo) e Ações.
- A lista já começa com: Aguardando cliente, Aguardando comprovante, Aguardando gestora, Aguardando lançamento e Aguardando quitação correta de cartão.
- Motivo que já foi usado não é apagado, só desativado, para preservar o histórico. As meninas apenas escolhem um motivo, sem texto livre no lugar dele.

## 2. Em cada lançamento (Fluxo Bancário)
- Pendência de outubro em diante sem motivo recebe o selo vermelho **"Sem justificativa"**.
- Novo botão **"Justificar"**: abre uma janela com a lista de motivos e uma observação curta opcional (até 200 caracteres). Dá para justificar vários lançamentos de uma vez.
- Pendência já justificada mostra o motivo no selo, por exemplo "Aguardando cliente". Passar o mouse mostra a observação, quem justificou e quando.
- Quando o lançamento for conciliado, a justificativa fica guardada no histórico.

## 3. Fechar o dia (bloqueio)
- Novo botão **"Finalizar conciliação do dia"** por empresa.
- O fechamento só acontece quando todas as pendências de outubro em diante até aquela data têm motivo. Se faltar algum, aparece a lista exata: conta, data, descrição e valor, com atalho para justificar.
- A trava também vale no servidor, não só na tela.

## 4. Central de Clientes (sem poluir)
- A tela principal não muda.
- Só dentro de **Pendências**, ao abrir a carteira de uma responsável e depois uma empresa, aparece o resumo por motivo, por exemplo "12 aguardando cliente · 3 sem justificativa". Clicar em um motivo mostra os lançamentos dele.

## O que não muda
Valores, saldos, Dashboard, Fluxo Diário e as pendências de setembro continuam iguais. Nenhum lançamento é apagado.

## Detalhes técnicos
- Migration aditiva:
  - tabela `recon_justification_reasons` (id, nome, ativo, sort_order), com GRANTs, RLS de leitura para admin/super_admin e escrita só `is_super_admin()`, e seed dos 5 motivos;
  - colunas nulas em `bank_transactions`: `justification_reason_id`, `justification_note`, `justified_by`, `justified_at`;
  - tabela `bank_recon_day_closures` (school_id, dia, closed_by, closed_at, unique), com GRANTs e RLS;
  - RPC `close_recon_day(_school_id, _day)` SECURITY DEFINER que recusa o fechamento quando existe pendência com data >= 2026-10-01 e <= _day sem motivo, e devolve as linhas faltantes.
- Constante `JUSTIFICATION_START = '2026-10-01'` compartilhada entre a tela e o servidor.
- Conferir antes se o trigger `guard_bank_tx_immutable` permite atualizar essas colunas novas. Se não permitir, ajustar a exceção só para elas.
- A RPC do backlog da gestão passa a devolver motivo e contagem por motivo.
- Testar na prévia: justificar um lançamento de teste datado de outubro e confirmar que o fechamento é bloqueado e depois liberado.
