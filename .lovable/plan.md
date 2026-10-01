# Central ao vivo: mostrar todas as empresas nos cards

## O que acontece hoje
A lista tem as 60 empresas ativas, mas os quatro cards de cima somam só 49 (12 + 19 + 9 + 9). As 11 que faltam não têm nenhuma conta bancária cadastrada no Fluxo Bancário. Por isso aparecem como "Indisponível" e não entram em nenhum card:

Contorno, Demo, FourBio, Go Company, Joinville Centro, Joinville Norte, OAP, Piraquara, Quintal de Casa, Rondonópolis e WNC.

Oito delas (Contorno, FourBio, Go Company, Joinville Centro, Joinville Norte, OAP, Rondonópolis e WNC) ainda nem têm as configurações da Central (responsável, prazo), porque foram criadas antes dessa área existir.

## O que vou fazer
1. **Novo card "Sem Fluxo Bancário"** ao lado dos outros quatro, cinza, com a contagem (11). Ao clicar, filtra a tabela por essas empresas, como os outros cards. Assim os cards passam a somar o total da carteira.
2. **Linha da empresa:** no lugar do traço, "Sem conta bancária cadastrada", com atalho para cadastrar a conta.
3. **"Demo" fora da Central:** é a empresa de demonstração e não deve contar na carteira.
4. **Configurações que faltam:** criar as configurações da Central (sem responsável) para as 8 empresas antigas, para aparecerem também em "Por responsável" como "Definir responsável".
5. Publicar.

## Detalhes técnicos
- `ManagementCenter.tsx`: card extra cujo `match` usa `dailyReconState(...) === 'unavailable'`; o texto da linha usa o mesmo estado.
- Migration: `get_management_portfolio` e `get_management_daily_status` excluem `is_demo_school(s.id)`; inserir em `school_management_settings` (school_id, is_active = schools.ativo) as linhas que faltam, com `ON CONFLICT DO NOTHING`.
