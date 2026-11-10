\set SU '''00000000-0000-0000-0000-000000000010'''
\set GA '''00000000-0000-0000-0000-000000000011'''
\set AP '''00000000-0000-0000-0000-000000000013'''
\set FG '''00000000-0000-0000-0000-000000000014'''
\set AM '''00000000-0000-0000-0000-000000000015'''
\set CL '''00000000-0000-0000-0000-000000000016'''
\set DL '''00000000-0000-0000-0000-000000000017'''
\set A '''00000000-0000-0000-0000-0000000000a1'''
\set B '''00000000-0000-0000-0000-0000000000b1'''
\set C '''00000000-0000-0000-0000-0000000000c1'''
INSERT INTO public.user_permissions VALUES ('00000000-0000-0000-0000-000000000013','access_use'),('00000000-0000-0000-0000-000000000015','access_admin'),('00000000-0000-0000-0000-000000000017','access_use');
\set F 'proposta'
-- criação
SELECT t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'banco','Banco Ficticio',NULL,'usuario.teste','Fict1cia!',true,'{"tipo_login":"compartilhado","codigo_operador":"12345"}','Tok3n#2','senha_app',true)::text$q$,:A)) AS e1 \gset
SELECT t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'sistema','Sistema Restrito',NULL,'adm.teste','R3strita!',true,'{}')::text$q$,:A)) AS e2 \gset
SELECT t.try(:SU,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'banco','Banco C',NULL,'c.teste','Cc0nf!',true,'{}')::text$q$,:C)) AS e3 \gset
SELECT t.chk(:'F','gestora cria comum', :'e1','PERMITIDO');
SELECT t.chk(:'F','super cria em empresa restrita', :'e3','PERMITIDO');
SELECT t.chk(:'F','gestora marca item restrito', t.try(:GA,'authenticated',format('SELECT public.set_access_restricted(%L,true)::text',:'e2')),'PERMITIDO');
SELECT id AS h2r FROM public.client_access_history WHERE entry_id=:'e2' AND acao='marcado restrito' \gset
SELECT id AS h2c FROM public.client_access_history WHERE entry_id=:'e2' AND acao='criado' \gset
SELECT id AS h1c FROM public.client_access_history WHERE entry_id=:'e1' AND acao='criado' \gset
-- grupo de apoio (usar) entre empresas
SELECT t.chk(:'F','apoio revela senha de outra carteira', t.try(:AP,'authenticated',format('SELECT public.reveal_access_secret(%L,%L)',:'e1','copiar')),'Fict1cia!');
SELECT t.chk(:'F','apoio revela 2ª senha protegida', t.try(:AP,'authenticated',format('SELECT public.reveal_access_secret(%L,%L,%L)',:'e1','ver','senha2')),'Tok3n#2');
SELECT t.chk(:'F','apoio lista acessos comuns de A', t.try(:AP,'authenticated',format('SELECT count(*)::text FROM public.client_access_entries WHERE school_id=%L',:A)),'1');
SELECT t.chk(:'F','apoio NÃO edita', t.try(:AP,'authenticated',format($q$SELECT public.save_access_entry(%L,%L,NULL,'X',NULL,'y',NULL,false,'{}')::text$q$,:'e1',:A)),'NEGADO');
SELECT t.chk(:'F','apoio NÃO arquiva', t.try(:AP,'authenticated',format('SELECT public.archive_access_entry(%L,true)::text',:'e1')),'NEGADO');
SELECT t.chk(:'F','apoio NÃO cria', t.try(:AP,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'b','Novo',NULL,NULL,NULL,false,'{}')::text$q$,:A)),'NEGADO');
SELECT t.chk(:'F','apoio NÃO vê senha antiga (histórico)', t.try(:AP,'authenticated',format('SELECT public.reveal_access_history_secret(%L)',:'h1c')),'NEGADO');
SELECT t.chk(:'F','apoio NÃO vê auditoria', t.try(:AP,'authenticated',format('SELECT count(*)::text FROM public.get_access_audit(%L)',:A)),'NEGADO');
SELECT t.chk(:'F','apoio não lê tabela de registros de uso', t.try(:AP,'authenticated','SELECT count(*)::text FROM public.client_access_views'),'0');
-- item restrito
SELECT t.chk(:'F','apoio NÃO revela item restrito', t.try(:AP,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e2')),'NEGADO');
SELECT t.chk(:'F','gestora (editar) NÃO revela item restrito', t.try(:GA,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e2')),'NEGADO');
SELECT t.chk(:'F','gestora não lista item restrito', t.try(:GA,'authenticated',format('SELECT count(*)::text FROM public.client_access_entries WHERE id=%L',:'e2')),'0');
SELECT t.chk(:'F','gestora NÃO edita item restrito', t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(%L,%L,NULL,'X',NULL,'y','nova',true,'{}')::text$q$,:'e2',:A)),'NEGADO');
SELECT t.chk(:'F','gestora NÃO arquiva item restrito', t.try(:GA,'authenticated',format('SELECT public.archive_access_entry(%L,true)::text',:'e2')),'NEGADO');
SELECT t.chk(:'F','gestora NÃO remove restrição', t.try(:GA,'authenticated',format('SELECT public.set_access_restricted(%L,false)::text',:'e2')),'NEGADO');
SELECT t.chk(:'F','gestora NÃO revela versão antiga do item restrito', t.try(:GA,'authenticated',format('SELECT public.reveal_access_history_secret(%L)',:'h2r')),'NEGADO');
SELECT t.chk(:'F','gestora NÃO restaura versão do item restrito', t.try(:GA,'authenticated',format('SELECT public.restore_access_version(%L)::text',:'h2r')),'NEGADO');
SELECT t.chk(:'F','gestora não lê histórico do item restrito', t.try(:GA,'authenticated',format('SELECT count(*)::text FROM public.client_access_history WHERE entry_id=%L',:'e2')),'0');
SELECT t.chk(:'F','administrar do módulo revela item restrito', t.try(:AM,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e2')),'R3strita!');
-- restaurar versão anterior ao restrito não tira a restrição
SELECT t.chk(:'F','admin restaura versão anterior à restrição', t.try(:AM,'authenticated',format('SELECT public.restore_access_version(%L)::text',:'h2r')),'PERMITIDO');
SELECT t.chk(:'F','restauração mantém item restrito', (SELECT restrito::text FROM public.client_access_entries WHERE id=:'e2'),'true');
SELECT t.chk(:'F','gestora segue sem revelar após restauração', t.try(:GA,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e2')),'NEGADO');
-- versão antiga criada ANTES da restrição continua protegida pelo item atual
SELECT t.chk(:'F','versão antiga (pré-restrição) protegida', t.try(:GA,'authenticated',format('SELECT public.reveal_access_history_secret(%L)',:'h2c')),'NEGADO');
-- snapshot restrito restaurado em item desmarcado continua restrito
SELECT t.chk(:'F','admin remove restrição', t.try(:AM,'authenticated',format('SELECT public.set_access_restricted(%L,false)::text',:'e2')),'PERMITIDO');
SELECT id AS h2x FROM public.client_access_history WHERE entry_id=:'e2' AND acao='restrição removida' \gset
SELECT t.chk(:'F','snapshot da remoção guardou restrito=true', (SELECT restrito::text FROM public.client_access_history WHERE id=:'h2x'),'true');
SELECT t.chk(:'F','item desmarcado: apoio passa a revelar', t.try(:AP,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e2')),'PERMITIDO');
SELECT t.chk(:'F','apoio NÃO restaura snapshot restrito', t.try(:AP,'authenticated',format('SELECT public.restore_access_version(%L)::text',:'h2x')),'NEGADO');
SELECT t.chk(:'F','gestora NÃO restaura snapshot restrito em item desmarcado', t.try(:GA,'authenticated',format('SELECT public.restore_access_version(%L)::text',:'h2x')),'NEGADO');
SELECT t.chk(:'F','admin restaura snapshot restrito', t.try(:AM,'authenticated',format('SELECT public.restore_access_version(%L)::text',:'h2x')),'PERMITIDO');
SELECT t.chk(:'F','item volta a restrito após restaurar snapshot restrito', (SELECT restrito::text FROM public.client_access_entries WHERE id=:'e2'),'true');
SELECT t.chk(:'F','apoio bloqueado após restauração', t.try(:AP,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e2')),'NEGADO');
SELECT t.chk(:'F','apoio não lista item após restauração', t.try(:AP,'authenticated',format('SELECT count(*)::text FROM public.client_access_entries WHERE id=%L',:'e2')),'0');
-- contorno direto
SELECT t.chk(:'F','UPDATE direto restrito=false bloqueado', t.try(:GA,'authenticated',format('UPDATE public.client_access_entries SET restrito=false WHERE id=%L RETURNING 1',:'e2')),'NEGADO');
SELECT t.chk(:'F','DELETE direto bloqueado', t.try(:GA,'authenticated',format('DELETE FROM public.client_access_entries WHERE id=%L RETURNING 1',:'e1')),'NEGADO');
SELECT t.chk(:'F','INSERT direto em histórico bloqueado', t.try(:GA,'authenticated',format($q$INSERT INTO public.client_access_history(entry_id,school_id,acao) VALUES (%L,%L,'x') RETURNING 1$q$,:'e2',:A)),'NEGADO');
SELECT t.chk(:'F','snapshot interno não executável', t.try(:GA,'authenticated','SELECT public._acc_snapshot(NULL::public.client_access_entries,$$x$$)::text'),'NEGADO');
SELECT t.chk(:'F','coluna cifrada sem leitura', t.try(:GA,'authenticated','SELECT secret_enc::text FROM public.client_access_entries LIMIT 1'),'NEGADO');
SELECT t.chk(:'F','2ª senha cifrada sem leitura', t.try(:GA,'authenticated','SELECT secret2_enc::text FROM public.client_access_entries LIMIT 1'),'NEGADO');
SELECT t.chk(:'F','chave sem leitura', t.try(:GA,'authenticated','SELECT k FROM private.access_key'),'NEGADO');
SELECT t.chk(:'F','observação/extras não expostos', t.try(:GA,'authenticated','SELECT observacao FROM public.client_access_entries LIMIT 1'),'NEGADO');
-- metadados estruturados
SELECT t.chk(:'F','metadado livre recusado', t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'b','Z',NULL,NULL,NULL,false,'{"obs":"senha: abc"}')::text$q$,:A)),'NEGADO');
SELECT t.chk(:'F','código operador com letras recusado', t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'b','Z',NULL,NULL,NULL,false,'{"codigo_operador":"Senha123"}')::text$q$,:A)),'NEGADO');
SELECT t.chk(:'F','senha_transacao recusada como 2ª senha', t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'b','Z',NULL,NULL,NULL,false,'{}','x','senha_transacao',true)::text$q$,:A)),'NEGADO');
SELECT t.chk(:'F','frase_recuperacao recusada como 2ª senha', t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'b','Z',NULL,NULL,NULL,false,'{}','x','frase_recuperacao',true)::text$q$,:A)),'NEGADO');
SELECT t.chk(:'F','tipo de 2ª senha fora da lista recusado', t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(NULL,%L,'b','Z',NULL,NULL,NULL,false,'{}','x','qualquer',true)::text$q$,:A)),'NEGADO');
-- gestor e ações normais
SELECT t.chk(:'F','gestora edita item comum', t.try(:GA,'authenticated',format($q$SELECT public.save_access_entry(%L,%L,NULL,'Banco Ficticio',NULL,'usuario.teste','N0va!',true,'{"tipo_login":"individual"}')::text$q$,:'e1',:A)),'PERMITIDO');
SELECT t.chk(:'F','gestora vê senha antiga do item comum', t.try(:GA,'authenticated',format('SELECT public.reveal_access_history_secret((SELECT id FROM public.client_access_history WHERE entry_id=%L AND acao=%L))',:'e1','senha alterada')),'Fict1cia!');
SELECT t.chk(:'F','gestora arquiva item comum', t.try(:GA,'authenticated',format('SELECT public.archive_access_entry(%L,true)::text',:'e1')),'PERMITIDO');
SELECT t.chk(:'F','arquivar preenche archived_at', (SELECT (archived_at IS NOT NULL)::text FROM public.client_access_entries WHERE id=:'e1'),'true');
SELECT t.chk(:'F','gestora desarquiva item comum', t.try(:GA,'authenticated',format('SELECT public.archive_access_entry(%L,false)::text',:'e1')),'PERMITIDO');
SELECT t.chk(:'F','desarquivar limpa archived_at', (SELECT (archived_at IS NULL)::text FROM public.client_access_entries WHERE id=:'e1'),'true');
SELECT t.chk(:'F','fora do grupo NÃO usa A', t.try(:FG,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e1')),'NEGADO');
SELECT t.chk(:'F','fora do grupo não lista A', t.try(:FG,'authenticated',format('SELECT count(*)::text FROM public.client_access_entries WHERE school_id=%L',:A)),'0');
-- externo, anônimo, desligada
SELECT t.chk(:'F','cliente da própria empresa NÃO usa', t.try(:CL,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e1')),'NEGADO');
SELECT t.chk(:'F','cliente não lista', t.try(:CL,'authenticated','SELECT count(*)::text FROM public.client_access_entries'),'0');
SELECT t.chk(:'F','anônimo sem RPC', t.try(NULL,'anon',format('SELECT public.reveal_access_secret(%L)',:'e1')),'NEGADO');
SELECT t.chk(:'F','anônimo sem tabela', t.try(NULL,'anon','SELECT count(*)::text FROM public.client_access_entries'),'NEGADO');
SELECT t.chk(:'F','autenticado sem usuário (uid nulo) NÃO usa', t.try(NULL,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e1')),'NEGADO');
SELECT t.chk(:'F','desligada (papel removido, permissão sobrando) NÃO usa', t.try(:DL,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e1')),'NEGADO');
DELETE FROM public.user_permissions WHERE user_id='00000000-0000-0000-0000-000000000013';
SELECT t.chk(:'F','apoio com permissão revogada NÃO usa', t.try(:AP,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e1')),'NEGADO');
INSERT INTO public.user_permissions VALUES ('00000000-0000-0000-0000-000000000013','access_use');
-- empresa restrita
SELECT t.chk(:'F','apoio NÃO usa empresa restrita', t.try(:AP,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e3')),'NEGADO');
SELECT t.chk(:'F','administrar do módulo NÃO usa empresa restrita', t.try(:AM,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e3')),'NEGADO');
SELECT t.chk(:'F','super usa empresa restrita', t.try(:SU,'authenticated',format('SELECT public.reveal_access_secret(%L)',:'e3')),'Cc0nf!');
-- nenhum ganho fora do módulo
SELECT t.chk(:'F','apoio: admin_manages_school(A) segue falso', t.try(:AP,'authenticated',format('SELECT public.admin_manages_school(%L)::text',:A)),'false');
SELECT t.chk(:'F','apoio: user_has_school_access(A) segue falso', t.try(:AP,'authenticated',format('SELECT public.user_has_school_access(auth.uid(),%L)::text',:A)),'false');
SELECT t.chk(:'F','administrar do módulo: admin_manages_school(A) segue falso', t.try(:AM,'authenticated',format('SELECT public.admin_manages_school(%L)::text',:A)),'false');
-- auditoria
SELECT t.chk(:'F','auditoria registra nome/serviço/ação', t.try(:AM,'authenticated',format($q$SELECT quem||'|'||empresa||'|'||servico||'|'||acao FROM public.get_access_audit(%L) WHERE quem='apoio@exemplo.test' AND acao='copiar'$q$,:A)),'apoio@exemplo.test|Escola Teste A|Banco Ficticio|copiar');
SELECT t.chk(:'F','auditoria inclui mudanças (criar/editar/arquivar/restaurar/restringir/remover)', t.try(:AM,'authenticated',format($q$SELECT string_agg(DISTINCT acao,',' ORDER BY acao) FROM public.get_access_audit(%L) WHERE acao IN ('criado','senha alterada','arquivado','restaurado do arquivo','restaurado','marcado restrito','restrição removida')$q$,:A)),'arquivado,criado,marcado restrito,restaurado,restaurado do arquivo,restrição removida,senha alterada');
SELECT t.chk(:'F','auditoria de mudança traz ator/empresa/serviço/horário', t.try(:AM,'authenticated',format($q$SELECT quem||'|'||empresa||'|'||servico||'|'||(quando IS NOT NULL) FROM public.get_access_audit(%L) WHERE acao='marcado restrito'$q$,:A)),'gestora.a@exemplo.test|Escola Teste A|Sistema Restrito|true');
SELECT t.chk(:'F','auditoria não devolve colunas de segredo', (SELECT string_agg(parameter_name,',' ORDER BY ordinal_position) FROM information_schema.parameters WHERE specific_name LIKE 'get_access_audit%' AND parameter_mode='OUT'),'quem,empresa,servico,quando,acao');
SELECT t.chk(:'F','gestora NÃO vê auditoria', t.try(:GA,'authenticated',format('SELECT count(*)::text FROM public.get_access_audit(%L)',:A)),'NEGADO');
SELECT t.chk(:'F','tentativas negadas não geram registro de revelação', (SELECT count(*)::text FROM public.client_access_views WHERE user_id IN ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000017')),'0');
