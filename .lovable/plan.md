# Renovação: leitura do Omni (Piraquara) e telefone (Rondonópolis)

## O que já vi
- A planilha do Omni que você mandou tem o formato esperado: 20 colunas, entre elas Turma, Aluno, Matrícula, Telefone e Instrutor.
- O sistema já tem um leitor para esse formato. O erro deve estar no que acontece depois da leitura, em Piraquara. Isso ainda não foi confirmado.
- Ainda não vi os arquivos e planilhas gravados de Piraquara e de Rondonópolis.

## Passos
1. **Conferir Piraquara:** ver qual arquivo foi gravado, de qual sistema o arquivo foi identificado, quantos alunos entraram e o que aparece na planilha. Depois, comparar com o arquivo enviado aqui. Pontos suspeitos:
   - o arquivo ser tratado como Contas a Receber;
   - o Contas a Receber do Sponte, que não existe para escolas do Omni, impedir a montagem;
   - as colunas do Modelo da escola não estarem ligadas às colunas do Omni.
2. **Conferir Rondonópolis:** ver se o telefone vem no relatório do Sponte e com qual nome de coluna. Também ver se a coluna Telefone do Modelo está ligada ao campo certo, celular ou residencial, e se existe correção antiga da equipe deixando o campo vazio.
3. **Corrigir a causa encontrada**, sem perder o trabalho manual que a equipe já fez nas planilhas.
4. **Telefone único:** se a escola marcar só "Telefone", preencher com o celular e, se não houver, com o residencial. Isso vale para o Sponte e para o Omni.
5. **Aviso na tela:** quando uma coluna marcada como "Usar" não vier no relatório, mostrar o aviso "essa coluna não veio no relatório", em vez de deixar a coluna em branco sem explicação.
6. **Testar:** com o arquivo do Omni enviado (133 alunos, todos com telefone) e com os dados reais de Rondonópolis. Depois, rodar os testes da renovação.

## Depois de aprovado
Em Piraquara e Rondonópolis, apertar **Recalcular planilha** uma vez para preencher o que estiver em branco.

## Detalhes técnicos
- Arquivos: `src/lib/renewal/sponteParser.ts` (`detectOmni`/`fromOmni`, mapeia Telefone → FoneCelular), `mergeEngine.ts` (pick e aliases), `fields.ts`.
- Conferir no banco as tabelas `renewal_*` das duas escolas: uploads, linhas e `overrides`.
- Criar testes novos em `src/test/renewal.test.ts`.
