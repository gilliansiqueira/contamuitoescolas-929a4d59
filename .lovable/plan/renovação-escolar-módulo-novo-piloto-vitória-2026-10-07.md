# Renovação escolar — módulo novo (piloto: Vitória)

## O que os arquivos de Vitória mostram
- **Modelo aprovado (1º Sem 2026):** uma aba "Turmas Existentes". No topo fica o quadro de resumo por professor (qtd. de turmas, alunos, renovados, % renovados), com contagem por Status e por Situação do Contrato. Embaixo, a base com Turma, Professor, Integrantes, Aluno, Professor, Venc. última parcela, Status Renovação, Situação do Contrato, Turma de Destino, Forma de Pgto, Data Remat. e Observações. Status é lista fechada (Rematriculado / Pendente / Não Rematriculará), e Situação do Contrato também tem lista própria.
- **Turmas Existentes (Sponte):** 288 alunos, cada um com matrícula única. Traz curso, estágio, modalidade (Normal, InCompany, Personal), término e número do contrato. O passo a passo pede Personal, VIP, Semi e ON em outra aba.
- **Contas a Receber (Sponte):** 2.121 parcelas. Categorias: Parcela Regular, Parcela Especial, Material Didático, Matrícula, Taxa, Reposição. **Não traz número do contrato**, então o cruzamento será por matrícula. O passo a passo também cruzava por nome.
- **Link do Instagram:** não consigo abrir, porque o Instagram pede login. Pode descrever o check que ela quer ou mandar um print? Até lá, a proposta é: Status e Situação viram botões coloridos de 1 clique em cada linha, mais "marcar selecionados" em lote.

## Fase 1 — fluxo completo em Vitória (esta entrega)
1. **Menu "Renovação escolar"** (só equipe), com a visão geral: escola, período, responsável, última atualização, versão e status (Aguardando relatórios → Em preparação → Em revisão → Pronta para envio → Enviada → Alteração solicitada).
2. **Modelo da escola:** enviar a planilha aprovada e clicar em "Usar este arquivo como modelo". A prévia mostra abas, colunas, ordem, listas de opções, fórmulas e quadro de resumo, e marca cada coluna como importada, calculada ou manual. O modelo fica com versões, e só uma é a aprovada. Os alunos do período anterior ficam só como referência.
3. **Configuração por escola:** "Considerar material na última parcela" (liga/desliga; Vitória = desliga), categorias que contam como parcela do módulo (Vitória: Parcela Regular e Parcela Especial) e modalidades que vão para aba separada.
4. **Relatórios necessários:** para o modelo e o período, mostra Turmas Existentes e Contas a Receber com o caminho no Sponte, os filtros, quais colunas cada um preenche e se já foi recebido ou está pendente. Há um cadastro de fontes e regras; regra não validada aparece como "dúvida".
5. **Importação com conferência:** Excel/CSV, cabeçalho detectado, títulos e totais descartados, datas e matrículas normalizadas. O cruzamento é por matrícula; por nome, só quando for exato e único. Nomes parecidos, vários contratos ou aluno sem par vão para uma lista de conferência. Todos os alunos da base são mantidos; quem não tem parcelas aparece como "Sem informação", nunca como quitado.
6. **Última parcela:** o maior vencimento entre as parcelas válidas do módulo, sem canceladas, material (quando desligado) ou outros serviços. No cartão parcelado sem dado do parcelamento, aparece "A confirmar". Término do contrato e término do pagamento ficam em colunas separadas.
7. **Tela em formato de planilha:** edição na célula, copiar e colar vários campos, alteração em lote, busca, filtros e ordenação, linhas e colunas extras, renomear, mover, ocultar e ajustar largura, tipos texto/data/valor/lista, salvamento automático e desfazer. Correção manual guarda o valor original. Mudança de formato pergunta: "Aplicar somente nesta planilha" ou "Salvar como novo modelo desta escola".
8. **Reimportação:** preserva observações, negociações e correções. Quando o Sponte traz um valor diferente de uma correção manual, a diferença aparece para revisão.
9. **Exportar Excel** no formato do modelo, com as mesmas abas, colunas, listas, formatação e fórmulas do resumo. Turmas são contadas como turmas distintas, sem precisar apagar repetidas.
10. **Registrar envio:** data, destinatário, canal e versão. Fica guardada uma cópia fixa do arquivo enviado. Editar depois cria uma nova versão e mostra "revisão não enviada". Pedidos de mudança do cliente são registrados e acompanhados até resolver.

## Fase 2 (depois de validar Vitória)
- Salto e outras escolas usando o mesmo fluxo; reaproveitar o modelo para outro período.
- Relatórios extras (contratos, pagamentos, parcelamento no cartão) para tirar o "A confirmar".
- Acesso do cliente só à própria escola, sem editar.

## O que ainda falta para validar regras
- Print ou descrição do check do vídeo do Instagram.
- Lista completa de "Situação do Contrato" (a lista do modelo está em P26:P31; vou ler de lá, mas confirme se é a atual).
- Relatório de parcelamento no cartão do aluno, se existir no Sponte (sem ele, cartão parcelado fica "A confirmar").
- Arquivos de Salto, para a Fase 2.

## Detalhes técnicos
- Tabelas novas (com política `can_see_school` + acesso por carteira; cliente bloqueado na Fase 1): `renewal_templates` (school_id, version, approved, structure jsonb: abas/colunas/regras/fórmulas/validações), `renewal_sources` (catálogo: nome, caminho Sponte, filtros, campos), `renewal_fill_rules` (coluna → fonte/campo/transformação, validada sim/não), `renewal_school_settings` (material on/off, categorias do módulo, modalidades em aba separada), `renewal_sheets` (school_id, period, template_version, status, responsável), `renewal_imports` (arquivo, fonte, linhas, rastreabilidade), `renewal_rows` (sheet_id, matrícula, contrato, dados importados jsonb, overrides jsonb com valor original/autor/data), `renewal_match_issues`, `renewal_versions` (snapshot + arquivo no armazenamento privado), `renewal_deliveries`, `renewal_change_requests`.
- Colunas identificadas por id estável; renomear ou mover não altera a regra.
- Leitura de .xls/.xlsx com `xlsx` (já instalado) no navegador; exportação com fórmulas e validações via `exceljs`; grade de planilha com componente leve próprio (virtualização) para manter o visual atual.
- Cálculo de última parcela e cruzamento em `src/lib/renewal/` com testes usando os dois relatórios de Vitória como amostra.
- Isolado dos cálculos financeiros (não usa nem altera SSOT). Regra registrada em `AGENTS.md`.
