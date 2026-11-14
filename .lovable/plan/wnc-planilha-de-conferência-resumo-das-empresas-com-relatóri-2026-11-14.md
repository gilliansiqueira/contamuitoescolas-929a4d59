# WNC: planilha de conferência + resumo das empresas com relatório Stone

## 1. Planilha da WNC (para a equipe conferir ou excluir no Tiny)
Um arquivo Excel em Arquivos, com 3 abas:

- **Excluir no contas a pagar**: as 21 contas abertas da folha de outubro (vencimento 05/11) que já foram pagas no Pix de 04/11. Colunas: pessoa, valor, categoria, vencimento, nº no Tiny e o Pix que a pagou. A "Bonificação MDZ" da Juliana (R$ 186,15) aparece separada como **"Manter: verificar"**.
- **Verificar categoria**: lançamentos em que a categoria veio do histórico e merece uma olhada. A Iolanda vem primeiro: Pix de R$ 8.773,04 do dia 13/11, que ficou em "NÃO VAI PRA DRE" porque os pagamentos anteriores dela estão nessa categoria. A aba mostra os últimos pagamentos dela e as categorias usadas, para a equipe decidir se o certo é uma categoria de confecção. Também entram os outros 31 lançamentos classificados pelo histórico.
- **Ainda a classificar**: os 39 lançamentos que seguem em "A classificar", com data, valor, descrição e o motivo (sem histórico, ou histórico dividido entre categorias, com as categorias encontradas).

Nada é alterado no Tiny nem na plataforma. É só material de conferência. Se a equipe decidir outra categoria para a Iolanda, eu troco depois.

## 2. Resumo das empresas com relatório Stone na plataforma
Uma lista (no chat e numa aba da mesma planilha ou num arquivo à parte) com as empresas que têm planilha da Stone enviada na aba Cartões, mostrando para cada uma:
- se tem relatório de **vendas**, de **recebimentos** ou os dois;
- o período coberto e a data do envio.

Hoje são 24 empresas com Stone. Exemplos: BH Cidade Jardim, Brasília, Champagnat, Cristo Rei, Fazenda Rio Grande, Foz, Indaiatuba, Manaus, Ourinhos, Palmital, Rio Verde, Rondonópolis, Salto, São Braz, São Carlos, São Mateus, Sinop, SJP e Vitória.
- Só vendas, sem recebimentos: Piraquara, Uberlândia Centro, Uberlândia Santa Mônica e Clínica Aniella.
- Rede, Getnet e PagSeguro ficam de fora, mas listados à parte para referência.

## Detalhes técnicos
- Lê as contas e os lançamentos do Tiny pela ação `ops get`/`inspect` já existente (somente leitura) e o `erp_push_log` da WNC.
- O resumo da Stone vem de `card_sheet_imports` (adquirente = Stone), agrupado por empresa e tipo.
- O arquivo é gerado em `/tmp` e copiado para Arquivos como `wnc_conferencia_tiny.xlsx` e `relatorios_stone_empresas.xlsx`.
