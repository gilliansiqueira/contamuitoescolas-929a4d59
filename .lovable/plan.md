# Passo a passo: vincular o Tiny (Olist ERP) da Quintal de Casa

Não precisa programar nada: a ligação com o Tiny já existe (é a mesma da WNC). Só falta pegar as chaves e autorizar.

## Antes de começar
- Entrar no Tiny com um usuário **administrador** da conta (o mesmo acesso usado para os dois CNPJs).
- Na plataforma, entrar como administradora na **Quintal de Casa › Fluxo Bancário › Contas bancárias** e achar o quadro **Olist ERP / Tiny**.
- As contas Inter dos dois CNPJs já devem estar cadastradas (é delas que saem os lançamentos).

## 1. Copiar o endereço de retorno (na plataforma)
1. No quadro do Tiny, clicar em **Cadastrar aplicativo**.
2. A janela mostra um **endereço de retorno**. Copiar exatamente como está (é o mesmo usado na WNC).

## 2. Criar o aplicativo no Tiny (é daqui que saem as chaves)
1. No Tiny: **Configurações › Aplicativos** (em algumas contas aparece como *Integrações › Aplicativos / API v3*).
2. Clicar em **Novo aplicativo** (ou "Criar aplicativo").
3. Preencher:
   - **Nome:** Conta Muito
   - **URL de redirecionamento / retorno:** colar o endereço copiado no passo 1.
   - **Permissões:** marcar leitura e edição de **Financeiro** (contas a pagar, contas a receber, caixa, contas financeiras/categorias) e leitura de **Contatos**.
4. Salvar. O Tiny mostra o **Client ID** e o **Client Secret**. O secret às vezes aparece só uma vez: deixar a janela aberta até o passo 3.

## 3. Colar as chaves na plataforma
1. Voltar à janela "Cadastrar aplicativo" e colar **Client ID** e **Client Secret**. Clicar em **Salvar** (ficam guardados de forma criptografada; ninguém consegue vê-los depois).
2. Clicar em **Autorizar na Olist**. Abre a tela do Tiny pedindo login e permissão: entrar com o usuário administrador e **Permitir**.
3. Ao voltar, o quadro deve mostrar **Autorizado**.

## 4. Ligar as contas
1. No quadro, ligar **cada conta Inter** (Ecoturismo e Expedições) à **conta financeira** correspondente no Tiny.
2. Definir a **data de início**: o dia seguinte ao último lançamento já feito à mão no Tiny (para não duplicar, como aconteceu na WNC).

## 5. Testar antes de ligar o automático
1. Deixar o **modo teste** ligado e clicar em **Enviar agora**: ele mostra o que seria lançado, sem gravar no Tiny.
2. Conferir alguns lançamentos (valor, data, categoria, se a baixa encontrou a conta certa).
3. Estando certo, desligar o modo teste. A partir daí os envios acontecem sozinhos, uns 20 minutos depois de cada leitura do Inter.

## Problemas comuns
- **"redirect_uri inválido"**: o endereço no Tiny não está exatamente igual ao da plataforma (espaço, barra no final).
- **Erro 401/403 ao enviar**: faltou permissão de Financeiro no aplicativo; editar o aplicativo, marcar e autorizar de novo.
- **Não aparece "Aplicativos" no Tiny**: o plano do Tiny precisa ter a API liberada, ou o usuário não é administrador.

## Do meu lado
Nada a implementar. Se algum passo der erro, me mandem um print que eu confiro pelo histórico da integração.
