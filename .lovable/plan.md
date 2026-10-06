# Extrato esporádico + publicar

Some clients (like Pinheirinho's Caixa) send statements only occasionally. Today a missing statement turns the Central ball red and blocks Meu Day checks. A per-account "extrato esporádico" flag fixes this: the account keeps its last known balance until a new statement arrives, with no red ball and no daily pressure on the team.

## Changes

1. **Database** — new migration adds `bank_accounts.extrato_esporadico` (boolean, default false).
2. **Central daily status** — update `get_management_daily_status` so `statement_received` ignores sporadic accounts entirely. If a school has only sporadic accounts, it is always considered "received" (never red).
3. **Meu Day** (`useMyDay.ts`) —
   - Statement coverage ("não saiu da conta" check) is computed only from non-sporadic accounts; if all accounts are sporadic, the check is skipped rather than falsely claimed.
   - Confirmed bank balance no longer requires all anchors on the same date when the stale account is marked sporadic: the balance uses each account's last confirmed anchor, dated by the most recent one.
4. **Account form** (Fluxo Bancário → Contas) — add an "Extrato esporádico" checkbox with a short helper line, plus a small badge on the account row so the team can see at a glance which accounts are exempt.

## After building

- Run tests, check build log is clean, then publish so the pending Bairro Alto (BB saldo) and Fazenda Rio Grande (Bradesco) fixes reach the live site together with this feature.
