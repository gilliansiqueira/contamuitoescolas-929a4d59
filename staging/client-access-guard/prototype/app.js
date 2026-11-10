"use strict";
// PROTÓTIPO: tudo em memória, dados inventados, sem rede. Regras aqui são só ilustração;
// o backend (RPCs + RLS) precisa impor exatamente as mesmas.
const COMPANIES = [
  { id: "A", name: "Escola Alfa (fictícia)", restrita: false },
  { id: "B", name: "Escola Beta (fictícia)", restrita: false },
  { id: "R", name: "Empresa Gama (fictícia, restrita)", restrita: true },
];
let ITEMS = [
  { id: 1, co: "A", name: "Sistema Escolar Fictício", url: "sistema-ficticio.invalid/login", user: "alfa.relatorios", pass: "FICTICIA-alfa-123", restrito: false },
  { id: 2, co: "A", name: "Maquininha Fictícia", url: "maquininha.invalid", user: "alfa.fin", pass: "FICTICIA-maq-456", restrito: false },
  { id: 3, co: "A", name: "Banco Fictício (restrito)", url: "banco.invalid", user: "alfa.banco", pass: "FICTICIA-banco-789", restrito: true },
  { id: 4, co: "B", name: "ERP Fictício", url: "erp-ficticio.invalid", user: "beta.relatorios", pass: "FICTICIA-erp-321", restrito: false },
  { id: 5, co: "R", name: "Painel Fictício Gama", url: "painel.invalid", user: "gama.adm", pass: "FICTICIA-gama-000", restrito: false },
];
const PEOPLE = { operacional: "Operadora Fictícia", editor: "Editora Fictícia", admin: "Admin Fictícia" };
const LINKED = { editor: ["A"] }; // vínculo fictício do editor
const audit = [];
const revealed = new Map(); // itemId -> timeout
const REVEAL_MS = 10000;
const $ = (id) => document.getElementById(id);
const role = () => $("role").value;

// ---- Matriz de permissões (espelho do que o backend deve impor) ----
const canSeeCompany = (r, co) => r === "admin" || !co.restrita;
const canUse = (r, it) => r === "admin" || !it.restrito;          // ver/copiar
const canEdit = (r, it) => r === "admin" || (r === "editor" && !it.restrito && (LINKED.editor || []).includes(it.co));
const canAudit = (r) => r === "admin";

function log(it, action) {
  audit.unshift({ at: new Date().toLocaleTimeString("pt-BR"), who: PEOPLE[role()], co: it.co, svc: it.name, action });
  renderAudit();
}
function toast(msg) { const t = $("toast"); t.textContent = msg; t.style.display = "block"; clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = "none"), 2500); }

function renderCompanies() {
  const sel = $("company"), prev = sel.value;
  sel.innerHTML = "";
  COMPANIES.filter((c) => canSeeCompany(role(), c)).forEach((c) => sel.add(new Option(c.name, c.id)));
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}
function hideAll() { revealed.forEach((h) => clearTimeout(h)); revealed.clear(); }

function renderCards() {
  const r = role(), co = $("company").value, box = $("cards");
  box.innerHTML = "";
  ITEMS.filter((i) => i.co === co).forEach((it) => {
    const usable = canUse(r, it);
    const c = document.createElement("article");
    c.className = "card" + (it.restrito ? " restricted" : "");
    c.setAttribute("data-item", String(it.id));
    const h = document.createElement("h3"); h.textContent = it.name; c.append(h);
    if (it.restrito) { const b = document.createElement("span"); b.className = "badge"; b.textContent = "RESTRITO"; c.append(b); }
    if (!usable) { const p = document.createElement("p"); p.className = "note"; p.textContent = "Indisponível para o seu papel."; c.append(p); box.append(c); return; }
    const u = document.createElement("p"); u.textContent = "Usuário: " + it.user; c.append(u);
    const s = document.createElement("p"); s.className = "secret";
    s.textContent = revealed.has(it.id) ? it.pass : "••••••••"; c.append(s);
    const row = document.createElement("div"); row.className = "row";
    const btn = (label, fn, dis) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.disabled = !!dis; b.onclick = fn; row.append(b); };
    btn("Abrir endereço", () => { log(it, "abrir endereço"); toast("Endereço fictício (não navega): " + it.url); });
    btn(revealed.has(it.id) ? "Ocultar" : "Mostrar (10s)", () => toggleReveal(it));
    btn("Copiar senha", () => copy(it));
    if (canEdit(r, it)) btn("Editar", () => openEdit(it));
    c.append(row); box.append(c);
  });
}
function toggleReveal(it) {
  if (revealed.has(it.id)) { clearTimeout(revealed.get(it.id)); revealed.delete(it.id); }
  else { log(it, "ver senha"); revealed.set(it.id, setTimeout(() => { revealed.delete(it.id); renderCards(); }, REVEAL_MS)); }
  renderCards();
}
async function copy(it) {
  log(it, "copiar senha");
  try { await navigator.clipboard.writeText(it.pass); toast("Senha fictícia copiada"); }
  catch { toast("Cópia indisponível neste navegador (protótipo)"); }
}
let editing = null;
function openEdit(it) {
  if (!canEdit(role(), it)) return; // backend também precisa recusar
  editing = it; $("fName").value = it.name; $("fUrl").value = it.url; $("fUser").value = it.user; $("fPass").value = "";
  $("editDlg").showModal();
}
$("cancelEdit").onclick = () => $("editDlg").close();
$("editForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!editing || !canEdit(role(), editing)) { $("editDlg").close(); return; }
  editing.name = $("fName").value.trim(); editing.url = $("fUrl").value.trim(); editing.user = $("fUser").value.trim();
  const np = $("fPass").value; log(editing, "editar");
  if (np) { editing.pass = np; log(editing, "alterar senha"); }
  $("editDlg").close(); renderCards();
});
function renderAudit() {
  const show = canAudit(role()); $("audit").hidden = !show; if (!show) return;
  const tb = $("auditBody"); tb.innerHTML = "";
  audit.forEach((a) => { const tr = document.createElement("tr"); [a.at, a.who, a.co, a.svc, a.action].forEach((v) => { const td = document.createElement("td"); td.textContent = v; tr.append(td); }); tb.append(tr); });
}
$("role").onchange = () => { hideAll(); renderCompanies(); renderCards(); renderAudit(); };
$("company").onchange = () => { hideAll(); renderCards(); };
renderCompanies(); renderCards(); renderAudit();
