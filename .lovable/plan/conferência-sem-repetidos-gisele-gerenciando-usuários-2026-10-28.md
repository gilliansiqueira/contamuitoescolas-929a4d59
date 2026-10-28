# Conferência sem repetidos + Gisele gerenciando usuários

## 1. Conferência da Renovação sem retrabalho
**Causa:** a cada novo envio/recálculo, o sistema apaga só as pendências abertas e recria todas — inclusive as que a equipe já tinha conferido ou desconsiderado. Por isso aparecem duas vezes (uma aberta, outra já marcada), como Laura, Isabella, Marcos e Lindah no print de Rondonópolis.

**Correção:**
- Ao recalcular, se o mesmo aviso (mesmo tipo + mesmo aluno/matrícula) já foi conferido ou desconsiderado, ele **não é criado de novo** — a decisão da equipe vale.
- Só volta a aparecer se a situação mudar (ex.: número de parcelas diferente) — aí reabre uma única vez, com a mensagem nova.
- Limpeza das duplicatas que já existem hoje em todas as escolas: mantém a versão conferida e remove a cópia aberta.
- Teste automático cobrindo: recalcular duas vezes não duplica; aviso conferido não volta; mudança de parcelas reabre.

## 2. Gisele gerencia usuários
- Dar à Gisele (gisele@contamuito.com.br) a mesma liberação da Isabelly: criar e alterar colaboradores, inclusive o próprio cadastro e senha.
- Mesmas travas: não pode virar proprietária, nem mexer na conta da proprietária.
- Conferir que a tela "Equipe e acessos" aparece no login dela.

## Detalhes técnicos
- `src/lib/renewal/persist.ts`: antes do insert, carregar issues `resolved=true` da planilha; chave `kind|row_key|parcelas`; pular as já existentes.
- Migração de dados (insert tool): deletar `renewal_issues` com `resolved=false` que tenham par resolvido com mesmo `sheet_id,kind,row_key`.
- `user_permissions`: inserir `collaborators_manage` para a Gisele (verificar se ela tem papel `admin`; se não, avisar antes).
