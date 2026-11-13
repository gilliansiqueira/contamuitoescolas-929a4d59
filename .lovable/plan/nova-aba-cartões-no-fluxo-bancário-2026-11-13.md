# Nova aba "Cartões" no Fluxo Bancário

## O que a equipe vai ver
Uma aba nova **Cartões**, ao lado de "Contas e Extratos", com só duas áreas:

1. **Recebimentos das adquirentes** (Stone, Cielo, Getnet, Rede, PagSeguro, Mercado Pago etc.) — botão "Enviar planilha".
2. **Vendas** (relatório de vendas da maquininha ou do Sponte/Omni) — botão "Enviar planilha".

Cada envio segue o padrão dos extratos:
- **Conferência antes de gravar:** quantidade de linhas, total geral, total por bandeira/forma (crédito, débito, PIX), distribuição por dia. Se o total do arquivo não bater com a soma das linhas, bloqueia e mostra as linhas responsáveis.
- Escolha da adquirente e mapeamento automático das colunas (data da venda, data prevista/paga, bruto, taxa, líquido, bandeira, parcela, NSU/autorização). Lembra o último mapeamento por adquirente.
- **Sem duplicar:** reenviar o mesmo período substitui só aquele arquivo/adquirente; linhas iguais (mesmo NSU/data/valor) não entram duas vezes.
- Lista discreta dos arquivos enviados (nome, período, total, quem enviou) com botão "Excluir", que apaga tudo que veio daquele arquivo.

## O que NÃO muda
- Nada disso entra em receita, despesa, resultado ou saldo. É só material de conferência, para não duplicar o que já vem do extrato.
- Não concilia nada sozinho. Depois, a IA (ou a equipe) usa essas planilhas para conferir caso a caso: venda → recebimento da adquirente → crédito no banco.

## Quem vê
Somente a equipe (mesmo acesso de "Conciliação assistida"); clientes não veem. A aba aparece para qualquer empresa com Fluxo Bancário ligado.

## Detalhes técnicos
- Tabelas novas `card_sheet_imports` (rastreio: arquivo, hash, adquirente, tipo recebimento|venda, período, totais, enviado por) e `card_sheet_rows` (linhas normalizadas + linha original em JSON), com `origem_upload_id`, `source_kind`, `source_file`, `imported_at`; exclusão em cascata; RLS is_admin + acesso à empresa + RESTRICTIVE `can_see_school`.
- Leitor puro `src/lib/cardSheetParse.ts` (CSV/XLS/XLSX, números e datas no formato brasileiro, detecção de colunas por adquirente) com testes.
- Componente `CardSheetsPanel.tsx` na aba nova em `FluxoBancario.tsx`.
- Fora de `acquirer_sales` (que é dos conectores por API) para não misturar fontes; `receiptThreeWayMatch` poderá ler essas linhas numa etapa seguinte.
