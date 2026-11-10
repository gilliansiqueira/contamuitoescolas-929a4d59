# Proteção de destino de extratos

## Ativação
O frontend não foi publicado. As migrations 0116 e 0117 corrigem a ativação parcial de 0114/0115. A função atualizada foi implantada. Nenhuma identidade foi preenchida a partir de histórico; nenhum movimento foi atualizado ou reimportado.

**Transição atual:** `bank_import_guard_enforced()` é false quando não há configuração. As permissões RLS anteriores continuam necessárias; a tela antiga pode novamente guardar arquivo/importação/lote. Consistência empresa/conta permanece obrigatória. A proteção completa de identidade só cobre a nova rota durante a transição; não se afirma que a tela antiga valida o conteúdo do arquivo.

Cadastro existente completo e inequívoco é referência, sem checkbox e sem salvar todas as contas novamente. Banco conhecido resolve por alias exato ou código válido; agência, conta e zeros/dígitos são preservados. Complemento só é solicitado para cadastro incompleto/desconhecido ou conflito. Se houver documento no arquivo, exige documento específico da conta ou `holder_entity_id` explicitamente vinculado a uma `company_entities` da mesma empresa. A lista de CNPJs da empresa não autoriza qualquer titular automaticamente.

### Ativar depois da publicação
1. Bruna publica o frontend e abre a URL pública com sua sessão super_admin, recarregando a página.
2. Confere que a nova tela mostra o modelo preenchido e a conferência normal sem checkbox. A função atualizada já está implantada.
3. Em Fluxo Bancário → Contas/Extratos, clica **Ativar proteção após publicação** e confirma. A ação chama `set_bank_import_guard_enforced({_enabled:true})`, restrita a super_admin, uma única vez para a plataforma, não por conta/sincronização.
4. Confere o indicador **Proteção completa ativa**. Upload direto da tela antiga é recusado; Inter/API e pares manuais seguem seus caminhos fixos.
Rollback controlado, se necessário: solicitar ao agente `set_bank_import_guard_enforced({_enabled:false})` com sessão super_admin. Nenhum rollback de movimentos. Não foi feita ativação nesta rodada.

Normalização remove apenas pontuação/espaços, preserva zeros e dígitos. Uma identidade confirmada não pode existir em dois cadastros. Divergências não exibem números completos.

## Limites deliberados
- PDF/OCR: bloqueados no servidor até existir leitor de cabeçalho independente homologado. Não se aceita identidade enviada apenas pelo navegador.
- CSV/Excel: somente cabeçalho anterior à tabela, com Banco (código), Agência, Conta e opcional CPF/CNPJ do titular; cabeçalhos não suportados ou ausentes bloqueiam na nova rota. O botão gera modelo com identidade da conta selecionada; cadastro incompleto não entrega modelo inválido.
- Arquivo e gravação no banco não compartilham transação. A identidade é conferida antes do upload e novamente na transação; rejeição determinística tenta apagar o arquivo. Falha de limpeza é informada; resultado de transporte incerto preserva arquivo para conferência, sem afirmar rollback.
- O servidor verifica identidade, destino e autorização; as regras de leitura de movimentos/deduplicação continuam no frontend existente. Não se afirma validação integral independente dos valores do arquivo nesta etapa.
- Não houve teste de importação na tela com sessão real, nem gravação de fixtures no backend ativo. Testes de RPC usam PostgreSQL descartável com tabelas mínimas e predicados de autorização simulados, não equivalência completa de RLS de produção.

## Verificação reproduzível
- `bash src/test/bankIdentity.integration.sh`: 26 verificações SQL (14 lote/destino, 9 aliases/titular/ativação, 3 política de armazenamento) e concorrência em duas sessões. Banco UTF-8, socket local sem TCP, cluster encerrado e removido. Predicados de autorização simulados; política de armazenamento real das migrations aplicada às roles locais.
- Vitest em ambiente node, sem setup jsdom: bankIdentity (70), bankTemplate (5), bankCashflow (8), bankAutoInvest (11), bankFuturos (2). Total 96; fixtures exclusivamente fictícias nesta rodada.
- `deno check --node-modules-dir=auto supabase/functions/bank-statement-import/index.ts`.
- Compilação do frontend verificada no build automático da plataforma; não publicado.
- A primeira execução da suíte padrão encontrou canvas.node ausente. Reexecução dos testes puros em Node passou. A suíte preexistente ofxRepeatedFitid foi executada uma vez e leu seus três arquivos reais; não gravou dados. Ela foi excluída da execução final exclusivamente sintética. Essa execução incidental não prova validação de destino de dados reais.

Nenhuma compra. Contagem de créditos da conversa indisponível.