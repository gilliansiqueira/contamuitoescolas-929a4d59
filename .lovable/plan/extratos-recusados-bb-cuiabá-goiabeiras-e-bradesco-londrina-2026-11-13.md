# Extratos recusados: BB Cuiabá Goiabeiras e Bradesco Londrina Dom Bosco

## O que encontrei
- **Bradesco – Londrina Dom Bosco:** o arquivo traz a conta **41118-5** (agência não vem no arquivo), mas o cadastro está como **0411158-0**. São números diferentes, por isso a plataforma recusa.
- **Banco do Brasil – Cuiabá Goiabeiras:** depois da correção de ontem, o cadastro (agência 0046-9, conta 44267-4) bate com o PDF enviado. Simulei a conferência com este arquivo e ela passa. O erro que a equipe vê provavelmente é da página aberta antes da correção.

## O que vou fazer
1. Corrigir a conta do Bradesco de Londrina Dom Bosco para **41118-5** (agência 0053 continua). Lançamentos, saldos e conciliações não mudam.
2. Simular de novo a conferência dos dois arquivos com os cadastros finais.
3. BB de Goiabeiras: nenhuma mudança. Peço para a equipe atualizar a página (F5) e reenviar; se der erro, me mandar print da mensagem.

## Detalhes técnicos
- Atualização em `bank_accounts` id 60c427e0-99d1-4be6-ae86-e8e4ac29a00f (conta → '41118-5'), registrado em `audit_log`.
- Conferência com `headerIdentity`/`compareNumber` (mesma regra do servidor e de `bank_identity_cmp_num`).
