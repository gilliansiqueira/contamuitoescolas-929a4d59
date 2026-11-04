# Manter os "Desconsiderar" já marcados na Renovação

## O que encontrei em Manaus Centro
Você tinha razão. Seis alunos estavam marcados como resolvidos: Isaac Santos de Oliveira, João Pedro Xavier Boldy Ferreira, Sophia Loren Neves De Aquinno, Vitória Leticia da Costa Alfaia, Jessica Lyandra Zukeyama de Oliveira e Maria Socorro Bandeira Franca.

Quatro deles voltaram para a lista: Isaac, João Pedro, Sophia e Vitória. O motivo é que a data de corte mudou para 01/05 e o número de parcelas em aberto mudou (ex.: Sophia de 3 para 8, Vitória de 3 para 7). Hoje a plataforma reabre o aviso sempre que o texto muda, e a quantidade de parcelas faz parte do texto.

Jessica e Maria Socorro não voltaram e continuam resolvidas.

## O que vou fazer
1. **Regra nova:** quando um aluno for desconsiderado ou conferido em "Sem correspondência nas turmas", ele não volta mais por mudança no número de parcelas. Vale para o mesmo aluno, pela matrícula ou pelo nome. Ele só volta se aparecer outro tipo de problema.
2. **Manaus Centro agora:** marcar de novo como resolvidos os 4 que voltaram (Isaac, João Pedro, Sophia e Vitória), com o mesmo motivo que você deu antes. A lista cai de 9 para 5: Nonato Vitor Venâncio Costa, Rebecca Louise de Souza Ramos, Renata da Silva Maués, Francisco Carlos Gomes Pereira e Gissele dos Santos Cunha.
3. Vale também para todas as outras escolas na próxima importação.

## Detalhes técnicos
- `src/lib/renewal/persist.ts` (`dedupeAgainstResolved`): para `sem_correspondencia`, comparar por `kind` + matrícula (`detail.mat`) ou nome normalizado (`detail.sacado`), ignorando a mensagem. Buscar `detail` também nos resolvidos.
- Os 4 avisos abertos duplicados em `renewal_issues` da folha `9ca2a66c…`: marcar `resolved=true`, copiando a `resolucao` do aviso antigo do mesmo aluno, e registrar no histórico de alterações.
- Teste em `src/test/` para "mesmo aluno com outra contagem de parcelas continua desconsiderado".
