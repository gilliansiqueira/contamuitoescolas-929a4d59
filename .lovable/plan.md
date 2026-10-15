# Renovação: qualquer parcela que não seja material conta como módulo

## Problema
Hoje o sistema só reconhece como "módulo" as categorias escritas nas regras da escola. Se a categoria do Sponte vier um pouco diferente (ex.: Personal, VIP), a parcela é ignorada e o aluno cai em "Sem parcelas do módulo", como aconteceu com Márcia Bobroski Anghinoni em Rondonópolis.

## O que muda
1. Toda parcela **não cancelada** passa a contar como módulo, qualquer que seja a categoria (Inglês, Espanhol, Personal, VIP etc.).
2. **Material didático** continua fora, a não ser que a escola tenha ligado "incluir material".
3. A lista de categorias nas regras da escola deixa de ser obrigatória. Ela fica só como referência e não bloqueia mais nenhuma parcela.
4. Vale para todas as escolas. Depois de publicar, é só clicar em "Recalcular planilha": os alunos que têm parcelas saem da Conferência sozinhos. As edições da equipe não são apagadas.

## O que não muda
- Data de corte ("Parcelas a partir de") continua valendo.
- Nenhum dado financeiro é alterado.

## Detalhes técnicos
- `mergeEngine.ts` `isModuleInstallment`: retorna `true` para qualquer parcela não cancelada e não material (material segue `include_material`); `module_categories` deixa de filtrar.
- Texto de ajuda das regras da escola em `RenovacaoModule.tsx` ajustado.
- Teste em `src/test/renewal.test.ts`: categoria "Personal" conta; "Material" não conta; parcela cancelada não conta.
