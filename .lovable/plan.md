# Verificación del total de selección en la Conciliación

## Estado actual

La mejora de la barra de totales de selección en la Conciliación ya está implementada en `src/components/fluxo-bancario/BankTransactionsTable.tsx` y la compilación está OK. Lo único pendiente es verificarla en pantalla con la cuenta de administradora.

## Etapas

1. Solicitar el acceso de prueba con la cuenta de administradora (adm@contamuito) para poder abrir el preview autenticado. Esto es solo una sesión de prueba para mí — no crea ni cambia nada en el sistema ni para otros usuarios.
2. Abrir Fluxo Bancário → Movimentações (conciliação) de Dourados en el preview.
3. Marcar lanzamientos variados (conciliado, pendiente, no se aplica) y confirmar que:
   - la barra "Selecionados" aparece con cantidad y total en R$;
   - los subtotales de Conciliados / A conciliar / No se aplica cuadran con las líneas;
   - la barra se actualiza al marcar/desmarcar y desaparece al limpiar la selección;
   - después de "Conciliar selecionados" la barra se limpia y los totales del período se actualizan.
4. Reportar el resultado con captura de pantalla.
