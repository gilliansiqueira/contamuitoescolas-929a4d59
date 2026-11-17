# Salto: cliente vê as saídas pendentes e escreve a categoria

## O que o cliente vai ver
- Uma nova tela "Pendências" no acesso do cliente. Ela só aparece nas empresas liberadas, e por enquanto só Salto fica ligada.
- A lista mostra apenas as **saídas** do banco ainda pendentes de conciliação: data, conta, descrição do extrato e valor. Tem filtro por mês e uma busca.
- Cada linha tem um campo "Qual é essa despesa?" para o cliente escrever, por exemplo "material de limpeza" ou "manutenção do ar". Também dá para deixar uma observação.
- Depois de salvar, a linha mostra "Enviado em dd/mm" e o cliente ainda pode editar até a equipe conciliar.
- Entradas/receitas não aparecem. Fica pronto para ligar depois.

## O que a equipe vai ver
- No Fluxo Bancário de Salto, a pendência que tiver resposta do cliente mostra um balão com o texto dele. Isso facilita escolher o item do modelo e conciliar.
- Um filtro "Com resposta do cliente".
- A resposta do cliente é só uma anotação: ela **não classifica nem concilia nada sozinha**. Quem lança continua sendo a equipe.

## Segurança
- O cliente não ganha acesso às movimentações do banco. Ele só lê essa lista por uma consulta própria, que devolve apenas as saídas pendentes da empresa dele, e grava somente o próprio texto.
- Nada disso entra em cálculos financeiros: Resultado, Caixa e conciliação ficam iguais.

## Detalhes técnicos
- Migration:
  - nova tabela `bank_tx_client_notes` (bank_transaction_id único, school_id, categoria_texto, observacao, user_id, timestamps), com GRANT, RLS para equipe (is_admin) e RESTRICTIVE `can_see_school`.
  - nova chave `school_features.cliente_pendencias_saidas`, ligada para Salto.
- RPCs SECURITY DEFINER:
  - `client_pending_outflows(month)`: confere `user_has_school_access`, a chave da empresa, `recon_status='pendente'`, saída pela direção da movimentação e conta não virtual.
  - `save_client_tx_note(tx_id, texto, obs)`: só grava se a movimentação continuar pendente e for saída.
- Front:
  - nova página do cliente com o item no menu, condicionado à chave;
  - balão e filtro no Fluxo Bancário da equipe.
- Teste do filtro (só saídas pendentes) e da regra de não editar depois de conciliado.
- Registrar a regra no AGENTS.md.
