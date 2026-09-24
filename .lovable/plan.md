# Central de Clientes: deixar igual ao "Painel vibrante" escolhido

## O que aconteceu
As cores novas já estão no app de teste (conferido), mas ficaram discretas demais. Além disso, o site publicado (relatorioscontamuito.online) só recebe as mudanças depois de clicar em Publicar.

## O que vou mudar (só visual, nada de dados ou cálculos)
1. **Cartões do topo**: fundo levemente tingido na cor de cada situação (verde, âmbar, vermelho, azul), faixa superior mais grossa e número grande colorido.
2. **Situação de cada empresa**: selo cheio e forte (verde "Em dia", âmbar "Em andamento", vermelho "Atrasada", azul "Aguardando cliente", cinza "Sem etapas"), com texto branco.
3. **Bolinha**: maior, com brilho colorido; vermelha pulsando quando atrasada.
4. **Barra de progresso**: mais grossa e com o percentual colorido ao lado.
5. **Linhas da tabela**: faixa colorida à esquerda de cada linha conforme a situação e leve tom de fundo para atrasadas.
6. **Prioridades**: cartões com fundo colorido mais visível e ícone destacado.
7. Modo noturno com as mesmas cores em versão mais escura.

## Conferência
Entrar no preview como administradora e comparar com a imagem do "Painel vibrante" (claro e noturno). Depois, sugerir Publicar para aparecer no site oficial.

## Detalhes técnicos
- Arquivos: `src/components/management/ManagementCenter.tsx` e tokens em `src/index.css`.
- Apenas tokens semânticos (success, progress, destructive, info, muted); sem cores fixas.
