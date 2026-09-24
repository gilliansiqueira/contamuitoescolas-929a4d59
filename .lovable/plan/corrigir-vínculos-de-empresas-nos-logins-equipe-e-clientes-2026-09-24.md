# Corrigir vínculos de empresas nos logins (equipe e clientes)

## Onde organizar
Os acessos ficam em **Configurações → Usuários**. Clique na seta da linha da pessoa, depois em **Adicionar empresa**. A empresa marcada como "principal" também conta como acesso.

## O que está acontecendo
- **Responsável automática ignora a empresa principal.** A regra que escolhe a responsável olha só as empresas adicionais e deixa de fora a principal. Por isso Portão (principal da Emanuelly) e SJP (principal da Bella) estão sem responsável, e o cartão "Por responsável" fica incompleto.
- **Isabelly** está configurada como "Acessar todas as empresas" e tem só Salto como principal. Palmital e Ourinhos não estão ligadas a ela. Na Central, ela acaba vendo apenas Salto.
- **Cliente Palmital** (direcaopalmital@influx.com.br) só tem Palmital. Ourinhos não está ligada.
- Emanuelly (Portão, Cuiabá Goiabeiras, Cuiabá Jardim Itália) e Bella (SJP, Linhares, Bairro Alto, Campinas, Morada do Sol) já têm os acessos certos. O que falta é a responsável ser atribuída a partir da empresa principal.

## Correções
1. **Regra da responsável:** passar a considerar a empresa principal e as adicionais. Recalcular agora para todas as empresas e manter o cálculo automático quando a principal ou o escopo de alguém mudar em Usuários. Se uma empresa tiver mais de uma administradora, continua o seletor "Definir responsável".
2. **Isabelly:** mudar para "Lista definida" e ligar Palmital e Ourinhos, mantendo Salto.
3. **Cliente Palmital:** ligar Ourinhos como empresa adicional. Ao entrar, ele escolhe entre Palmital e Ourinhos.
4. **Central para escopo "todas as empresas":** administradoras nesse modo passam a ver a carteira inteira, como a tela de Usuários já promete.
5. **Conferência:** listar, para cada administradora, as empresas que ela acessa e as que aparecem como responsável, para você validar que nenhuma outra está faltando.

## Preservado
Nenhuma alteração em cálculos, relatórios, PDFs, lançamentos ou permissões de clientes além da Palmital.

## Detalhes técnicos
- Migration: `sync_school_management_responsible` passa a incluir `profiles.school_id` além de `user_schools` (admins com `admin_scope='list'`). Trigger em `profiles` (school_id/admin_scope). Backfill em todas as escolas.
- `get_management_portfolio`: adiciona `OR (is_admin() AND admin_scope='all')` do perfil do usuário.
- Dados: `profiles.admin_scope='list'` para Isabelly e `user_schools` com Palmital/Ourinhos. `user_schools` Ourinhos para o cliente Palmital.
