# Remove comandos de DADOS no nível superior (INSERT/UPDATE/DELETE/COPY/TRUNCATE fora de corpos $$),
# e chamadas cron./net. fora de funções. Mantém DDL e corpos de funções. Registra só nome do arquivo e tipo removido.
import sys, re, os, json
src, dst = sys.argv[1], sys.argv[2]
def split(sql):
    out, buf, i, dq, sq = [], [], 0, None, False
    while i < len(sql):
        c = sql[i]
        if dq:
            if sql.startswith(dq, i): buf.append(dq); i += len(dq); dq = None; continue
            buf.append(c); i += 1; continue
        if sq:
            buf.append(c); i += 1
            if c == "'": sq = False
            continue
        if sql.startswith('--', i):
            j = sql.find('\n', i); j = len(sql) if j < 0 else j; buf.append(sql[i:j]); i = j; continue
        if c == "'": sq = True; buf.append(c); i += 1; continue
        m = re.match(r'\$[A-Za-z0-9_]*\$', sql[i:])
        if m: dq = m.group(0); buf.append(dq); i += len(dq); continue
        if c == ';': out.append(''.join(buf)); buf = []; i += 1; continue
        buf.append(c); i += 1
    if ''.join(buf).strip(): out.append(''.join(buf))
    return out
removed = {}
for name in sorted(os.listdir(src)):
    if not name.endswith('.sql'): continue
    stmts = split(open(os.path.join(src, name), encoding='utf-8').read()); keep = []
    for s in stmts:
        body = re.sub(r'^(\s*--[^\n]*\n)*', '', s.lstrip()).lstrip()
        k = re.match(r'(insert|update|delete|copy|truncate)\b', body, re.I)
        cr = re.match(r'select\s+(cron|net)\.', body, re.I)
        if k or cr:
            removed.setdefault(name, []).append((k.group(1) if k else 'cron/net').upper()); continue
        keep.append(s)
    open(os.path.join(dst, name), 'w').write(';\n'.join(keep) + ';\n')
print(json.dumps(removed, indent=0))
