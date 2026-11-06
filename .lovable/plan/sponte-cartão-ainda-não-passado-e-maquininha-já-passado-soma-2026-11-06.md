# Sponte (cartão ainda não passado) e maquininha (já passado) somam, sem um apagar o outro

## O que acontece hoje
Quando a escola já tem recebimentos da maquininha, a importação do Sponte joga fora as linhas de Cartão de Crédito/Débito que caem no período coberto pela maquininha. Mas nas planilhas enviadas, as duas listas têm pessoas diferentes:
- **Contas a receber do Sponte** (463 linhas): parcelas que ainda vão ser cobradas, inclusive no cartão (aluno ainda não passou o cartão).
- **Recebimentos Stone** (1.212 linhas): parcelas de cartões que já foram passados, com Stone ID e número da parcela.

Ou seja, um relatório completa o outro.

## O que vai mudar
1. **Fim do descarte automático**: a importação do Sponte grava todas as linhas de cartão, mesmo com maquininha no mesmo período. E a importação da maquininha não apaga mais o cartão do Sponte.
2. **Substituição só dentro do mesmo tipo**: novo envio do Sponte substitui só Sponte a partir da data escolhida; novo envio da maquininha substitui só maquininha. Continua sem duplicar envios.
3. **Na conferência da importação**: um quadro mostra "Cartão no Sponte (a passar)" e "Cartão na maquininha (já passado)" separados, com o total de cada um, para dar para conferir.
4. **Aviso de possível duplicidade (sem apagar)**: se o mesmo valor aparecer nos dois relatórios no mesmo mês, a linha é mostrada para você decidir. Nada é removido sozinho.
5. **Regra registrada**: atualizo a regra antiga ("nunca coexistir") para essa nova, para não voltar o problema.

## Ponto de atenção
Em Rondonópolis, em novembro, apaguei 1.976 recebimentos de cartão do Sponte (R$ 1.133.443,99) usando a regra antiga. Depois da correção, será preciso **subir de novo o Sponte de Rondonópolis** para essas parcelas voltarem. Não vou recriar sozinha esses valores.

## Detalhes técnicos
- `src/lib/import/sponteCardGuard.ts`: deixa de descartar; passa a só listar suspeitas (mesmo valor + mês, em origens diferentes). Atualizar `src/test/sponteCardGuard.test.ts` com caso das planilhas enviadas (as duas listas somam).
- `ImportacaoSponteAuditada.tsx`: remover o filtro de descarte, exibir quadro e suspeitas.
- Conferir o caminho de upload da maquininha e o `projectionEngine`/`receivableCategorization` para garantir que nenhum filtra cartão do Sponte quando há origem `cartao`; substituição por data restrita à mesma origem.
- Atualizar AGENTS.md e a memória do projeto com a regra nova.
