# Patch do cliente (PROMOÇÃO FUTURA — não aplicado; a tela atual segue igual)
src/components/team/ImportCartaoPonto.tsx, linha 33–34: incluir `totais` e um `attempt_id` gerado UMA vez por clique:
```diff
-      const r = await save.mutateAsync({ arquivo: file, periodoInicio: rep.periodoInicio, periodoFim: rep.periodoFim,
-        funcionarios: rep.funcionarios.map(({ codigo, nome, matricula, departamento, funcao, dias }) => ({ codigo, nome, matricula, departamento, funcao, dias })) });
+      const attempt_id = crypto.randomUUID(); // reaproveitado só se a mesma tentativa for repetida após timeout
+      const r = await save.mutateAsync({ attempt_id, arquivo: file, periodoInicio: rep.periodoInicio, periodoFim: rep.periodoFim,
+        funcionarios: rep.funcionarios.map(({ codigo, nome, matricula, departamento, funcao, dias, totais }) => ({ codigo, nome, matricula, departamento, funcao, dias, totais })) });
```
Conferido no código: CartaoDia tem exatamente as chaves permitidas.
