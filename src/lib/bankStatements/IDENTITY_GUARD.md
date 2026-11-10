# Proteção de destino de extratos

## Ativação
O frontend não foi publicado. As migrations aditivas 0114 e 0115 já foram aplicadas e a função bank-statement-import foi implantada para suportar o frontend futuro. Nenhuma identidade existente foi habilitada, nenhum movimento foi atualizado ou reimportado.

**Impacto imediato:** upload direto pelo frontend publicado antigo passa a ser recusado pelo servidor. API Inter (service_role), saldo manual do super_admin e pares de cheques em conta virtual seguem rotas próprias. Não contorne a proteção para recuperar o upload antigo.

Equipe autorizada precisa conferir o cadastro de cada conta: código bancário de três dígitos, agência e conta completa com dígito, vínculo com a empresa selecionada e, opcionalmente, CPF/CNPJ autorizado daquela conta. Para empresa multi-CNPJ, cada conta deve ter seu titular correto, não a lista indiscriminada de todos os documentos. A confirmação é explícita; não se usa histórico ou primeiro upload para preencher.

Normalização remove apenas pontuação/espaços, preserva zeros e dígitos. Uma identidade confirmada não pode existir em dois cadastros. Divergências não exibem números completos.

## Limites deliberados
- PDF/OCR: bloqueados no servidor até existir leitor de cabeçalho independente homologado. Não se aceita identidade enviada apenas pelo navegador.
- CSV/Excel: somente cabeçalho anterior à tabela, com Banco (código), Agência, Conta e opcional CPF/CNPJ do titular; cabeçalhos não suportados ou ausentes bloqueiam. O modelo antigo sem identidade não é importável.
- Arquivo e gravação no banco não compartilham transação. A identidade é conferida antes do upload e novamente na transação; rejeição determinística tenta apagar o arquivo. Falha de limpeza é informada; resultado de transporte incerto preserva arquivo para conferência, sem afirmar rollback.
- O servidor verifica identidade, destino e autorização; as regras de leitura de movimentos/deduplicação continuam no frontend existente. Não se afirma validação integral independente dos valores do arquivo nesta etapa.
- Não houve teste de importação na tela com sessão real, nem gravação de fixtures no backend ativo. Testes de RPC usam PostgreSQL descartável com tabelas mínimas e predicados de autorização simulados, não equivalência completa de RLS de produção.

## Verificação reproduzível
- `bash src/test/bankIdentity.integration.sh`: 14 verificações SQL, banco socket local sem TCP, cluster encerrado e removido.
- Vitest em ambiente node, sem setup jsdom: bankIdentity (25), bankTemplate (2), bankCashflow (8), bankAutoInvest (11), bankFuturos (2). Total 48.
- `deno check --node-modules-dir=auto supabase/functions/bank-statement-import/index.ts`.
- Compilação do frontend verificada no build automático da plataforma; não publicado.
- A primeira execução da suíte padrão encontrou canvas.node ausente. Reexecução dos testes puros em Node passou. A suíte preexistente ofxRepeatedFitid foi executada uma vez e leu seus três arquivos reais; não gravou dados. Ela foi excluída da execução final exclusivamente sintética. Essa execução incidental não prova validação de destino de dados reais.

Nenhuma compra. Contagem de créditos da conversa indisponível.