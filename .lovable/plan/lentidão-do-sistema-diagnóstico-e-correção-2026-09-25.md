# Lentidão do sistema — diagnóstico e correção

O problema não é a sua internet: o servidor do sistema (banco de dados e login) não respondeu dentro do tempo limite na verificação de agora.

## Passos
1. Checar a saúde do servidor (uso de memória/CPU, conexões abertas) e as consultas mais lentas.
2. Se estiver travado, reiniciar o servidor (1–2 minutos fora do ar; nenhum dado é apagado ou alterado).
3. Se a causa for sobrecarga constante, avaliar aumentar a capacidade do servidor (envolve custo — pediremos sua aprovação antes) ou criar índices para as consultas mais pesadas (migration somente aditiva).
4. Confirmar que Dashboard, Fluxo Diário e Fluxo Bancário voltaram a carregar rápido.

## Garantias
- Nenhum dado financeiro, histórico ou tela é alterado.
- Nada é feito no histórico congelado até 01/09/2026.
