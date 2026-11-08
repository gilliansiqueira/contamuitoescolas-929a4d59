# Integração Banco Inter (leitura de saldo e extrato)

## Resposta curta

Dá para fazer. A API do Inter Empresas permite ler **saldo** e **extrato**. Os lançamentos lidos entram no mesmo Fluxo Bancário que hoje recebe OFX/PDF. Assim valem a mesma conciliação, a mesma classificação e o mesmo saldo conferido, e nenhuma regra financeira nova é criada. A integração será **só de leitura**: nunca faz pagamento nem PIX.

## Como funciona para o cliente (passo a passo)

1. O cliente, no Internet Banking do Inter Empresas, cria uma "Integração" marcando **apenas** as permissões de consulta de extrato e saldo.
2. O Inter entrega 4 itens: Client ID, Client Secret, certificado (.crt) e chave (.key).
3. Ele envia esses itens para nós. O ideal é que a própria equipe cadastre os dados na tela da empresa, sem que circulem por WhatsApp ou e-mail.
4. Um administrador liga a opção "Integração Banco Inter" naquela empresa e escolhe qual conta bancária já cadastrada recebe os lançamentos e a partir de que data.

## Segurança

- **Ativação por empresa:** a opção fica desligada por padrão. Só super_admin liga e desliga, e só aparece para contas marcadas como Banco Inter.
- **Credenciais guardadas criptografadas no servidor**, no mesmo padrão de "Acessos e senhas" (pgcrypto). Ninguém consegue ler de volta pela tela: depois de salvas, aparecem como "••• configurado". Para trocar, é preciso enviar de novo.
- **Somente o servidor fala com o Inter.** O navegador da equipe nunca recebe o certificado nem os tokens.
- **Escopo mínimo:** pedimos ao cliente só as permissões de leitura (extrato/saldo). Se a credencial vier com permissão de pagamento, a tela avisa e recomenda refazer.
- **Histórico:** toda configuração, troca de credencial, sincronização e erro fica registrado (quem, quando, resultado).
- Empresas restritas e inativas seguem as regras atuais: inativa não sincroniza.
- **Validade do certificado:** o certificado do Inter vence. A Central mostra um aviso 30 dias antes.

## Como os lançamentos entram (preservando a SSOT)

- Cada sincronização vira um **"upload" rastreável**, com origem "API Inter", data/hora e período lido. Excluir a sincronização apaga só os lançamentos dela, sem deixar órfãos.
- **Sem duplicar:** usa a mesma regra que já evita duplicidade entre PDF e OFX (mesmo dia, sentido, valor e texto). Ela também cobre o caso de alguém subir um OFX do mesmo período. Além disso, o identificador único que o Inter manda por lançamento garante que reler o mesmo dia não duplique.
- **Classificação:** os lançamentos entram como hoje entram os do extrato, pendentes de conciliação, com as sugestões automáticas e as regras por texto já existentes. Nada é classificado pelo sinal do valor.
- **Saldo:** o saldo lido do Inter vira a âncora "saldo conferido" do dia, a mesma usada hoje. Se o saldo do Inter não fechar com a soma dos lançamentos, a plataforma marca divergência e mostra as linhas do período, sem gravar ajuste automático.
- **Lançamentos futuros/agendados** ficam como previsão, igual aos débitos futuros do extrato.

## Frequência

- **Automática:** uma vez por dia, de madrugada, lendo os últimos 7 dias. Essa janela cobre lançamentos que o banco registra com atraso.
- **Botão "Sincronizar agora"** na conta bancária, para a equipe usar durante a conciliação.
- Sincronizações com falha (credencial vencida, permissão removida) aparecem na Central como pendência daquela empresa.

## Fases

1. **Prova técnica com 1 cliente piloto.** Confirmar que o servidor consegue se conectar ao Inter usando o certificado. O Inter exige um tipo de conexão especial (mTLS), e esse é o único ponto técnico incerto. Validar lendo saldo e extrato de 1 mês e comparando com o OFX do mesmo período.
2. **Cadastro seguro das credenciais e liga/desliga por empresa.**
3. **Sincronização diária, botão manual, deduplicação e âncora de saldo.**
4. **Avisos na Central** (falha, certificado vencendo, divergência de saldo).

## Detalhes técnicos

- Tabelas novas: `bank_api_connections` (school_id, bank_account_id, provider='inter', start_date, status, cert_expires_at, last_sync_at, last_error) com colunas `*_enc` sem SELECT, e `bank_api_sync_runs` (histórico). Ambas com RLS `is_admin` + RESTRICTIVE `can_see_school`. A ativação é controlada por `school_features.inter_api`.
- Gravação/leitura de credenciais só via RPC SECURITY DEFINER, com a chave em `private.access_key`, reaproveitando o padrão de `client_access_*`.
- Edge Function `inter-sync`: OAuth2 client_credentials com escopo `extrato.read`, mTLS via `Deno.createHttpClient({ cert, key })`, endpoints `/banking/v2/saldo` e `/banking/v2/extrato/completo` (paginado), token em memória (vale cerca de 1h) e respeito ao limite de requisições.
- Agendamento diário via pg_cron + pg_net chamando a função.
- Os lançamentos passam pelo mesmo caminho de gravação do import bancário: `origem_upload_id`, `source_kind='api_inter'`, `sameBankEntryText`, e o id da transação do Inter guardado para idempotência.
- Testes: mapeamento Inter para lançamento, deduplicação contra OFX e regra de divergência de saldo.

## Pontos para você decidir

- Quem cadastra as credenciais: a equipe, com os arquivos enviados pelo cliente, ou o próprio cliente pelo acesso dele? o administrador fará uma ligação com o cliente instruindo como fazer pra pegar os acessos
- Qual cliente com Inter será o piloto? WNC
- Se a sincronização diária de madrugada está boa, ou se precisa ser mais frequente (por exemplo, a cada 2 horas no horário comercial). Pode ser a cada 2 horas no horário comercial