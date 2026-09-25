# Publicar a área "Ponto da Equipe" no site oficial

## Resumo

A área nova está pronta e funcionando na prévia, mas ainda **não está no site oficial**: o código que hoje é servido em relatorioscontamuito.online e contamuitoescolas.lovable.app não contém a tela "Ponto da Equipe". Só aparece para quem abre a prévia. Este plano publica e confere.

## Passos

1. **Varredura de segurança atualizada** antes de publicar. Os dois avisos existentes são de nível informativo (as pastas de ícones de KPI e de bandeiras de cartão são públicas de propósito, porque são imagens usadas por todos). Não há nada crítico pendente, e nada será alterado agora.
2. **Publicar o projeto** (apenas a parte de telas). Isso leva a seção "Equipe" e a tela "Ponto da Equipe" para o site oficial. Costuma levar cerca de 1 minuto.
3. **Conferir no site publicado** que a área realmente entrou (o código servido passa a conter a tela) e que o site continua abrindo normalmente nos dois endereços.
4. **Conferir que nada mais mudou**: Dashboard, Fluxo Diário, Relatório Realizado, Análise de Despesas e Centro de Custos seguem com os mesmos números, e o menu dos clientes continua sem a nova seção.
5. **Entregar a lista final do que pedir à Employer/ePays** (forma de obter o token, endereço de produção, limites de consulta, exemplos de resposta, formato de datas, identificador único da colaboradora, se a credencial pode ser só de leitura, e se é preciso identificador de empresa/filial).

## O que NÃO muda

- Nenhuma migration nova, nenhuma tabela alterada, nenhum dado financeiro tocado.
- A sincronização automática continua **desligada** até confirmarmos os limites de consulta da API.
- O acesso à área continua restrito a super administrador (adm@contamuito), com proteção no servidor e nas tabelas — não é só o menu escondido.
- A visibilidade do site e os domínios conectados não são alterados.

## Detalhes técnicos

- Verificado agora: o arquivo de código publicado (`assets/index-DgBpT_1U.js`) não contém a string "Ponto da Equipe", enquanto os arquivos da prévia existem e o servidor de dados está saudável (tabelas `team_time_*` presentes, 2 execuções registradas como "não configurado", sincronização automática desligada).
- Sem a credencial da API, a tela publicada abre com o aviso "integração não configurada", que é o estado esperado nesta fase.
- A publicação não altera visibilidade, domínio nem permissões existentes.
