# Ajustes na moldura: Configurações só para admins e laranja mais sóbrio

## O que muda

### 1. Configurações
- O grupo "Configurações" sai do menu lateral.
- Para **administradores**, fica apenas um ícone de engrenagem no rodapé do menu (e no cabeçalho mobile), que abre as mesmas telas de hoje.
- Para **clientes**, nada aparece: nem o grupo, nem o ícone. Eles continuam vendo apenas Dashboard, relatórios e demais abas de leitura, como já é hoje.
- Nenhuma permissão muda: quem via as telas de configuração continua vendo; quem não via, continua sem ver.

### 2. Tom de laranja
- Modo claro: o menu passa do laranja vivo atual (`#F47A1F`) para um laranja mais escuro e sóbrio, próximo de **`#E05E08`** (degradê discreto `#E05E08 → #D1540A`), ficando entre o tom atual e o laranja queimado do modo noturno (`#9A3412`).
- Item selecionado continua creme com texto em laranja escuro; textos e ícones seguem brancos, com contraste garantido.
- Modo noturno permanece como está.

## O que NÃO muda
- Conteúdo, valores, gráficos, cálculos e relatórios: intactos.
- Rotas, permissões, importações e banco de dados: intactos.

## Detalhes técnicos
- `src/components/app-shell/AppSidebar.tsx`: remover o grupo Configurações da lista; adicionar botão de engrenagem no rodapé, renderizado só quando `isAdmin && !isPresentationMode && !isDemo`.
- `src/index.css`: ajustar os tokens de cor do menu (modo claro) para o novo laranja.
- Reversão: mudança isolada no shell; basta reverter esses dois arquivos.
