# Planilha de pendências de contas a pagar (setembro/2026)

Gerar um arquivo Excel para download com todas as saídas de setembro (01/09 a 30/09) que ainda não foram conciliadas no Fluxo Bancário, organizado para a equipe resolver rápido. Nada é alterado no sistema; é só leitura.

## Abas da planilha

1. **Resumo por empresa**
   - Empresa, responsável, quantidade de saídas pendentes, valor total pendente, maior pendência, data da pendência mais antiga, quantas já têm motivo preenchido.
   - Situação: "Quase lá" (1 a 3 pendências), "Atenção" (4 a 20), "Crítico" (mais de 20), com cores.
   - Ordenado das que estão mais perto de terminar para as mais atrasadas, para liberar relatórios primeiro.
   - Linha de total geral no final.

2. **Pendências detalhadas**
   - Uma linha por saída pendente: Empresa, Responsável, Conta (banco), Data, Descrição, Contraparte, Valor, Categoria atual, Motivo/justificativa (se houver), Arquivo do extrato.
   - Coluna "Possível causa" com sugestão automática simples: transferência sem conta de destino, tarifa bancária, sem categoria, valor repetido no mesmo dia.
   - Coluna vazia "Resolução" para a equipe anotar.
   - Filtro do Excel ligado e cabeçalho fixo.

3. **Por responsável**
   - Uma linha por pessoa: empresas sob responsabilidade, total de pendências e valor, para dividir o trabalho.

4. **Prontas para subir despesas**
   - Empresas com todas as saídas conciliadas e indicação se as despesas de setembro já foram subidas ou não (mesma consulta da resposta anterior).

## Como será feito
- Consulta no banco das saídas com conciliação pendente em setembro, nas empresas ativas (fora a empresa restrita e contas "Fora do banco").
- Valores em formato brasileiro (R$ 1.500,50), datas dd/mm/aaaa, fonte Arial.
- Arquivo: `pendencias_contas_a_pagar_setembro_2026.xlsx`, entregue como anexo no chat.

## Detalhes técnicos
- Geração via Python (openpyxl) no sandbox, a partir de consultas somente leitura (`bank_transactions` tipo saída, `recon_status='pendente'`, junções com `bank_accounts`, `schools`, `school_management_settings`, `recon_justification_reasons`, `bank_transaction_splits` quando dividido).
- Totais por empresa calculados com fórmulas no próprio Excel (SOMASE/CONT.SE) e recálculo conferido sem erros.
- Nenhuma alteração no código do app nem no banco.
