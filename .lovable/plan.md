# Central de Clientes — cores por situação ("Painel vibrante")

## Problema
A bolinha de situação quase não muda de cor: "Sem etapas cadastradas" é cinza e "Em andamento" usa o mesmo laranja da marca, então a lista parece monocromática e pouco intuitiva.

## Direção escolhida
Opção "Painel vibrante": cores fortes e distintas por situação, badges preenchidos, cards com faixa colorida no topo e barra de progresso colorida pela faixa.

## O que será feito (somente visual — `src/components/management/ManagementCenter.tsx` + tokens em `src/index.css`)

1. **Situações com cor única e bem distintas**
   - Em dia / Concluída → verde (`--success`)
   - Em andamento → âmbar mais escuro/distinto do laranja da marca (novo token, ex. `--progress`)
   - Atrasada → vermelho (`--destructive`), bolinha com pulso sutil
   - Aguardando cliente → azul (`--info`)
   - Sem etapas cadastradas → cinza claro com texto discreto
   - Bolinha ganha anel/brilho colorido (glow) e badge preenchido (fundo colorido forte, texto branco/escuro conforme o caso)

2. **Coluna Andamento**
   - Barra de progresso colorida pela faixa (0–49% âmbar, 50–99% azul-laranja conforme status, 100% verde)
   - Percentual com cor acompanhando a barra; botão "Configurar etapas" mantido

3. **Cards do topo**
   - Faixa colorida no topo de cada card (laranja, verde, âmbar, vermelho) com fundo colorido no ícone

4. **Prioridades de hoje**
   - Cards com fundo tingido pela cor da situação (vermelho/âmbar/azul) em vez da faixa lateral cinza atual

5. **Modo noturno**
   - Cores definidas via tokens semânticos (sem hex fixo nos componentes), mantendo contraste no tema escuro

## Fora de escopo
- Nenhuma mudança em dados, cálculos, colunas, filtros, permissões, etapas de fechamento ou fluxo bancário.
- Aba "Por responsável" mantém o layout atual (apenas herda os novos tons de status nos badges).

## Validação
- Conferir no preview a lista com empresas em situações diferentes (cadastrar etapas de teste e marcar uma etapa se necessário, depois desfazer).
- Verificar modo noturno e conferir que nada além do visual mudou (tsgo + testes).
