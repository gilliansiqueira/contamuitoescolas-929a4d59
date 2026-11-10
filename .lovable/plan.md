# Acessos e senhas — proposta mínima (só planejamento)

Nada foi alterado. Li apenas o código de estrutura (ClientAccess.tsx e migrations 0096–0098); nenhuma senha ou registro real foi consultado.

## 1. Proposta mínima e impacto na rotina

Três níveis de poder, separados da responsável da carteira:

| Poder | Quem | O que pode |
|---|---|---|
| Usar | Grupo operacional autorizado (lista fixa definida pela Bruna) + responsável da carteira | Ver login, revelar e copiar senha de acessos comuns de qualquer carteira |
| Editar | Responsável da carteira + quem a Bruna indicar | Criar, alterar, arquivar acessos da empresa |
| Administrar | Bruna (super_admin) e quem receber permissão explícita | Gerir o grupo, marcar acesso como restrito, ver auditoria completa |

- Acesso "restrito" (novo marcador por item): só Administrar revela. Empresas restritas continuam só com super_admin, como hoje.
- Ninguém ganha acesso automaticamente: o grupo começa vazio e a Bruna escolhe quem entra.
- Rotina: a colega abre a empresa de outra carteira e copia a senha normalmente, sem pedir autorização, sem justificativa e sem código extra a cada cópia.
- Senha revelada some sozinha depois de ~20 s; a cópia limpa a área de transferência depois de ~30 s quando o navegador permitir (sem garantia).
- Recomendação nos cadastros: preferir login individual por colaboradora ou login só de consulta quando o serviço oferecer (campo "tipo de login": individual / compartilhado / só consulta).

## 2. O que já existe vs. o que falta

Já existe:
- Senha cifrada no banco (pgcrypto), coluna cifrada sem leitura direta; leitura só por funções que registram "ver"/"copiar" e histórico de versões; arquivar em vez de apagar.
- Trava por empresa: `_access_can` = carteira da pessoa + empresa visível (restritas só super_admin).

Falta:
- Grupo operacional: hoje só quem gere a carteira (ou tem escopo de todas as empresas) usa; quem ajuda outra carteira não consegue.
- Separar usar de editar: o mesmo `_access_can` libera revelar, salvar, restaurar e arquivar.
- Marcador de acesso restrito por item.
- Ocultação automática: hoje a senha fica visível até clicar de novo.
- Auditoria legível: registra quem/quando/ação, mas falta uma tela com nome, empresa, serviço, horário e ação, filtrável.
- Campos livres: "extras" e "observação" ficam em texto claro, visíveis e pesquisáveis — podem virar depósito de senhas.

Esclarecimento importante: isto é criptografia no banco, não cofre ponta a ponta. A chave fica no mesmo banco (`private.access_key`); quem controla o backend pode decifrar. Protege contra leitura direta das tabelas pela tela, não contra comprometimento do backend.

## 3. Riscos essenciais antes de importar acessos

1. Segredos em campos livres: trocar "extras" livres por tipos fixos (código do operador, matrícula, celular do token, agência/conta) com tamanho limitado; observação curta com aviso. Um alerta simples para textos com cara de senha ("senha:", "pwd", sequência longa misturada) ao salvar — ajuda, mas não é detector infalível. Segundo segredo (ex.: senha de transação) vai em campo cifrado próprio, não em extras.
2. Chave no mesmo banco: aceitar conscientemente ou, no futuro, mover a chave para fora (cofre do backend). Não incluso no mínimo.
3. Grupo largo demais: cada pessoa no grupo pode copiar senhas de todas as carteiras não restritas; revisar a lista periodicamente.
4. Importação em lote: nada de planilha com senhas trafegando em e-mail/WhatsApp; importar pela própria tela ou por arquivo apagado logo após, e marcar restritos antes.
5. Cópia para a área de transferência fica fora do controle do sistema (gerenciadores de área de transferência do computador).

## 4. Plano de testes (só dados fictícios)

Empresas e usuárias fictícias ("Escola Teste A/B", "usuaria.grupo@exemplo.test", senha "Fict1cia!"):
- Membro do grupo revela/copia acesso comum de outra carteira: permitido e registrado.
- Membro do grupo tenta editar/arquivar/restaurar em outra carteira: negado.
- Responsável edita na própria carteira: permitido.
- Acesso restrito: só Administrar revela; grupo e responsável negados.
- Empresa restrita: invisível para todas exceto super_admin (regressão).
- Colaboradora fora do grupo e cliente: negados em tudo.
- Auditoria grava nome, empresa, serviço, horário e ação para ver/copiar/editar/arquivar.
- Coluna cifrada continua sem leitura direta; extras não aceitam tipo fora da lista nem texto acima do limite; alerta aparece para "senha: xyz".
- Senha revelada some após o tempo; nova revelação gera novo registro.
- Testes de banco no PostgreSQL descartável local (mesma técnica do ponto) + testes unitários da tela.

## 5. Teste realmente isolado

- Viável: PostgreSQL descartável local na sandbox (já usado no trabalho do ponto), com cópia mínima das tabelas `client_access_*`, das funções e de `can_see_school`/`admin_manages_school` reescritas como stubs. Sem tocar o backend ativo, sem dados reais.
- Não isolado: preview e qualquer edição em migrations aplicadas ou funções do backend, que vão para o backend compartilhado com produção.
- Requisitos: autorização para criar pasta de staging (como `staging/client-access-guard/`) e rodar o banco local; nenhuma credencial.
- Custo: sem compra; só o uso normal da conversa. Não consegui consultar créditos consumidos neste turno.
- Limite: a tela real e as permissões reais só podem ser conferidas na promoção, que exige nova autorização.

## Detalhes técnicos (para a etapa de implementação, se aprovada)

- `user_permissions`: novas chaves `access_use` (grupo) e `access_admin`; funções `_access_can_use(school)` = can_see_school AND (admin_manages_school OR access_use OR access_admin), `_access_can_edit(school)` = can_see_school AND admin_manages_school (ou access_admin), `_access_can_admin()` = is_super_admin OR access_admin.
- `client_access_entries.restrito boolean default false`; `reveal_access_secret` exige `_access_can_admin()` quando restrito.
- `save/restore/archive` passam a usar `_access_can_edit`; leitura das linhas usa `_access_can_use`.
- `extras` validado por CHECK/trigger: lista de tipos permitidos, valor ≤ 60 caracteres, observação ≤ 280.
- `client_access_views` ganha visão com nome do perfil, empresa e serviço para a tela de auditoria (só Administrar).
- UI: timer de ocultação em `ClientAccess.tsx`, seletor de tipo nos extras, selo "Restrito".
