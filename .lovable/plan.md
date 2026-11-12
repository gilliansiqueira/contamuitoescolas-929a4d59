# Cuiabá Goiabeiras: extrato da Stone recusado

## O que encontrei
- A Stone de Goiabeiras está cadastrada com agência 0001 e conta 4373635. A Stone de Jardim Itália está cadastrada com o mesmo número.
- As duas contas não são a mesma: em outubro, Goiabeiras tem 53 lançamentos (R$ 94.725,02) e Jardim Itália tem 58 (R$ 146.959,87).
- Por isso a proteção recusa o extrato de Goiabeiras: o número que vem no arquivo não bate com o cadastro. O provável é que o número de Jardim Itália tenha sido copiado para Goiabeiras.

## O que vou fazer
1. Ler no extrato da Stone de Goiabeiras o número real da conta.
2. Corrigir só o cadastro da Stone de Goiabeiras para esse número. Lançamentos e conciliações não mudam.
3. Conferir que Jardim Itália continua aceitando os extratos dela.
4. Guardar o texto de São Braz como modelo de estilo para os próximos relatórios. Ele substitui o exemplo atual do gerador de texto, que é o de Sinop.

## Preciso de você
Me envie aqui o extrato da Stone de Goiabeiras que está dando erro (OFX ou PDF). Sem ele eu não consigo ver o número certo da conta.

## Detalhes técnicos
- Contas: Goiabeiras 6bfc91b1-37a2-458d-9784-f7da19db445f e Jardim Itália 208d8c45-25b1-4664-bdbc-f6ff734d5a6c, ambas com `conta`=4373635.
- Correção por run_sql em `bank_accounts.conta` (e `holder_document`, se o arquivo trouxer).
- Modelo: trocar `EXEMPLO` em `supabase/functions/draft-monthly-analysis/index.ts` pelo texto aprovado de São Braz e publicar a função.
