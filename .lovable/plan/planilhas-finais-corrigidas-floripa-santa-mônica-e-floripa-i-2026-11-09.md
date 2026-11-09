# Planilhas finais corrigidas — Floripa Santa Mônica e Floripa Ingleses

Somente essas duas escolas. Nenhuma outra escola é recalculada.

## O que será entregue
Duas planilhas no mesmo formato final das que você enviou ("Renovação 1.2027.xlsx" e "Renovação 1.2027 SM.xlsx"):
- `Renovacao_1.2027_Ingleses_v2.xlsx`
- `Renovacao_1.2027_SM_v2.xlsx`

Cada uma mantém exatamente as mesmas abas, colunas, ordem, cores, filtros, resumo por professor, percentuais e totais da planilha original.

## O que muda
- Apenas a coluna da data da última parcela (e a forma de pagamento ligada a ela, quando mudou) dos alunos em que a data vinha de material didático, taxa ou reposição — agora vale a última parcela do módulo.
- Contas por professor e percentuais ficam como fórmulas, então se recalculam com as novas datas.
- Alunos com correção manual feita pela equipe não são alterados.
- Uma aba extra "Alterações" lista cada aluno alterado: data antiga, data nova e motivo.

## Conferência antes de entregar
- Mesmo número de alunos e professores da original.
- Somas por professor batem com o total geral; nenhum erro de fórmula.
- Visualizo as páginas para garantir que o formato ficou igual.

## Detalhes técnicos
- Partir de cópias dos arquivos enviados (openpyxl), localizando cada aluno por matrícula/nome normalizado e substituindo só as células de data/forma de pagamento com os valores já recalculados na plataforma.
- Preservar fórmulas existentes; se algum resumo tiver valores fixos, trocar por fórmulas equivalentes (CONT.SE/percentual).
- Recalcular com LibreOffice e checar zero erros; arquivos finais em Files.
