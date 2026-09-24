# Carteira da Rubia e acesso da Isabelly

## O que encontrei
- A **Rubia** está como administradora que vê todas as empresas. Quem vê todas não entra na lista de carteira, por isso ela não aparece. Hoje ela está ligada a Sinop, Manaus Laranjeiras e Dourados.
- **Sinop** ainda aparece como principal da **Isis**.
- **Fazenda Rio Grande** não tem responsável.
- A **Isabelly** vê só Salto, Palmital e Ourinhos.

## O que vou fazer
1. **Rubia:** passa a ver só Sinop, Manaus Laranjeiras, Dourados e Fazenda Rio Grande. Aparece na lista de carteira como responsável por essas 4.
2. **Isis:** sai de Sinop. A principal dela passa a ser Rio Verde, e ela continua com Rio Verde, Cristo Rei, São Carlos e Champagnat.
3. **Isabelly:** passa a ver todas as empresas. Continua aparecendo na lista como responsável por Salto, Palmital e Ourinhos, que são a carteira dela.
4. **Regra da carteira:** quem vê todas só entra na lista pelas empresas ligadas diretamente ao acesso dela. As outras administradoras que veem tudo (Acy, Tamy, adm) não têm empresas ligadas, então nada muda para elas.
5. **Conferir:** a lista "Por responsável" mostra a Rubia com 4 empresas, a Isabelly com 3 e a Isis sem Sinop.

## Detalhes técnicos
- Dados (run_sql):
  - `profiles.admin_scope='list'` para a Rubia; `user_schools` recebe Fazenda Rio Grande para ela.
  - `profiles.school_id` da Isis vira Rio Verde (a linha extra de Rio Verde em `user_schools` é removida para não duplicar).
  - `admin_scope='all'` para a Isabelly.
- Migration: em `sync_school_management_responsible` e `get_management_responsible_candidates`, o candidato passa a ser `admin_scope='list'` OU (`'all'` com vínculo explícito em `user_schools`/`profiles.school_id`). Depois, ressincronizar as empresas afetadas.
