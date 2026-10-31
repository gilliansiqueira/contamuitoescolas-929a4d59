# Folha de outubro: VR do Bruno/Rayssa e relatórios novos do plano

## O que muda
1. **VR fixo de R$ 80,00** para Bruno e Rayssa nos valores fixos da planilha (mesmo esquema da Priscila), valendo para outubro e meses seguintes.
2. **Aceitar o relatório do plano em CSV** (o formato que você mandou agora, separado por ponto e vírgula), além do formato antigo. Mesmas regras:
   - Mensalidade do titular: funcionária paga 40% (empresa 60%).
   - Dependentes e coparticipação: 100% da funcionária.
   - Ligação por nome; nome parecido pede confirmação.
3. **Aplicar os dois arquivos em outubro**:
   - Mensalidade (competência 11/2026) substitui a mensalidade salva no teste anterior.
   - Coparticipação (competência 09/2026, exames e consultas) entra somando por pessoa, incluindo dependentes no nome do titular.
4. Conferir na tela a planilha de outubro e listar para você os valores finais de plano e copart por pessoa.

## Detalhes técnicos
- `parseRel0051` em `src/lib/teamTime/payroll.ts`: detectar CSV (cabeçalho com `Valor Unitário`/`Tipo Lançamento`), decodificar latin1, ler `Competência`, `Nome Titular`, `Nome Beneficiário`, `Tipo Beneficiário`, `Valor Unitário` (formato 1.234,56), e classificar como coparticipação quando `Tipo Lançamento` não começa com o nome do plano (Exames/Consultas etc.).
- `PayrollSheet.tsx`: aceitar `.csv` no seletor de arquivo.
- Atualizar `team_payroll_defaults` (VR 80 para Bruno e Rayssa) e reenviar os dois relatórios em `team_payroll_uploads` para 10/2026 (o mais recente de cada tipo vale).
- Testes em `payroll` cobrindo leitura CSV, 40% titular e 100% copart/dependente.
