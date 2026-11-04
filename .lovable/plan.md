# Acessos e senhas por empresa

Nova tela **"Acessos e senhas"** no menu Operação de cada empresa (junto de Fluxo Bancário, Renovação e Folha e benefícios). Só a equipe vê; empresas restritas seguem só para super administradora. Liberada por empresa, como a Folha.

## Como fica a tela

Cabeçalho da empresa (razão social, CNPJ) e cartões agrupados por tipo, no mesmo espírito do documento do Champagnat:

- **E-mail da empresa** (Gmail usado para os acessos)
- **Sistemas escolares** (Sponte, Omni, portal da franquia)
- **Bancos e maquininhas** (Inter, Stone, PagBank, Caixa)
- **Benefícios** (Caju, Metrocard, URBS)
- **Contas de consumo** (Copel, Sanepar, Ligga, Vivo, TIM)
- **Seguros e outros**
- **Chaves PIX de pagamento** (fornecedores e pessoas: nome, tipo, chave)

Cada cartão tem: nome do serviço, link (botão "Abrir"), login, senha, campos extras (código do operador, matrícula, código de acesso, celular do token — ex.: "celular da girafinha") e observação.

- Senha aparece como `••••••`; botões **Mostrar** e **Copiar**. Login e link também copiam com um clique.
- Busca rápida por serviço ou login.

## Para nada se perder nem ser alterado sem querer

- **Edição só no botão "Editar"**, com confirmação; nada muda ao clicar no cartão.
- **Histórico de cada acesso**: toda troca de senha/login guarda a versão anterior, quem trocou e quando. Dá para ver e restaurar.
- **Não apaga**: "Arquivar" tira o cartão da lista, mas ele fica guardado e pode voltar.
- **Registro de quem viu/copiou** cada senha.
- Senhas **guardadas criptografadas** no banco; nunca aparecem no histórico de alterações em texto.

## Importação do Champagnat

Cadastro inicial do Champagnat a partir do documento enviado, já separado nos grupos acima, para você conferir antes de gravar. As demais empresas podem ser cadastradas pela tela (ou por arquivos no mesmo formato).

## Detalhes técnicos

- Tabelas `client_access_entries` (school_id, grupo, serviço, url, login, extras jsonb, observação, archived_at), `client_access_secrets` (senha criptografada com chave no Vault; leitura só por função `reveal_access_secret` que grava em `client_access_views`), `client_access_history` (versão anterior criptografada, autor, data), `client_pix_keys`.
- RLS: `is_admin() + user_has_school_access + RESTRICTIVE can_see_school`; sem DELETE para ninguém além de super_admin.
- Liberação `school_features.acessos_senhas`; aba `access` no `Index.tsx`.
- Fora de qualquer cálculo financeiro.
