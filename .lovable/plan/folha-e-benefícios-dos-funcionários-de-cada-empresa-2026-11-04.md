# Folha e benefícios dos funcionários de cada empresa

Nova tela **Folha e benefícios** no menu **Operação** das empresas, ao lado do Fluxo Bancário. Ela segue o mesmo modelo da tela de benefícios da nossa equipe, mas com os funcionários de cada cliente.

## O que a tela terá
1. **Cadastro de funcionários da empresa**
   - Nome, CPF (opcional), cargo e situação (ativo ou desligado, com data).
   - Valores fixos por dia: VR/dia e VT/dia, além de recebe VT (sim ou não).
   - **Chave PIX**: tipo (CPF, e-mail, telefone, aleatória) e chave. Fica guardada e é reaproveitada todo mês.
2. **Mês a mês (uma tabela por mês)**
   - **Dias trabalhados digitados à mão** por pessoa. O mês começa com os dias úteis já preenchidos, e você corrige.
   - Conta automática: VR = VR/dia × dias, VT = VT/dia × dias.
   - **Líquido do holerite**: vem do upload ou é digitado.
   - **PIX a pagar = líquido + VR + VT**, ao lado da chave PIX de cada pessoa.
   - Total do mês, com botões **Copiar** (nome, chave e valor) e **Baixar planilha**.
   - Quem tem holerite mas não está cadastrado, ou está cadastrado sem holerite, aparece destacado.
3. **Upload de holerites**
   - Aceita **PDF com todos juntos**, PDFs separados e planilha (Excel/CSV).
   - A leitura procura nome e líquido de cada holerite. Antes de gravar, mostra a conferência: quantos holerites, total dos líquidos e quem não foi encontrado no cadastro.
   - Se o PDF trouxer um total impresso e a soma não bater, a gravação fica bloqueada, mostrando as linhas da diferença.
   - Os arquivos ficam guardados. Subir de novo no mesmo mês substitui o anterior, e excluir o upload remove os líquidos que vieram dele.
4. **Liberação por empresa**: a tela só aparece nas empresas em que for ativada, como já acontece com outros recursos.

## O que não muda
- Nada disso entra em receita, despesa, resultado ou caixa da empresa. É uma ferramenta de conferência da folha.
- Quem vê: só a nossa equipe, com o mesmo acesso que tem à empresa. Os clientes não veem.

## O que preciso de você
- **Um PDF de holerites real** (de qualquer cliente) para ajustar a leitura ao formato da contabilidade. Até lá, o upload aceita planilha e o líquido pode ser digitado.

## Detalhes técnicos
- Tabelas novas com `school_id`, GRANTs, RLS `is_admin()` + `user_has_school_access` e política RESTRICTIVE `can_see_school`:
  - `client_employees`: nome, cpf, cargo, vr_diario, vt_diario, recebe_vt, pix_tipo, pix_chave, desligado_em, ativo.
  - `client_payroll_month`: school_id, month, employee_id, dias_trabalhados, liquido, liquido_origem_upload_id, unique (school_id, month, employee_id).
  - `client_payroll_uploads`: school_id, month, source_file, source_kind, storage_path, imported_at, totals, e cascata para os líquidos.
- Bucket privado `client-payroll-files`; políticas no `storage.objects` pelo prefixo `school_id/`.
- Liberação em `school_features.folha_beneficios`.
- Regras puras em `src/lib/clientPayroll.ts` (cálculo VR/VT/PIX, casamento de nomes do holerite, conferência de totais), com teste em `src/test/clientPayroll.test.ts`.
- Leitura de holerites em `src/lib/clientPayroll/parseHolerites.ts`, reaproveitando a extração de texto de PDF que já existe nos extratos (inclusive com senha).
- Tela `src/components/client-payroll/ClientPayroll.tsx`, entrada `payroll` no grupo Operação do `Index.tsx`.
