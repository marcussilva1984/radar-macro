# Radar Macro

Timeline de eventos macro/geopolíticos (bancos centrais, guerras/sanções/OPEP, dados
econômicos) cruzada com a reação de ativos de fluxo (DXY, ouro, treasuries 10Y, BTC, S&P 500)
no dia seguinte. Objetivo: entender **por que** o mercado se moveu numa semana e **para onde**
o capital está migrando — complementar ao Terminal de Mercado (outro projeto), que foca em
preço/altas-baixas por classe de ativo.

## Status (Fase 1 — MVP)

- Ingestão de eventos via RSS: Fed, BCB, geopolítica global (filtrado por keywords: guerra,
  sanção, OPEP, tarifa, etc).
- Ingestão diária de 5 ativos de fluxo via Yahoo Finance (sem chave).
- Página única: timeline cronológica evento → variação dos ativos no dia seguinte.

Fora do MVP por enquanto: grafo visual interativo, ETF flows (BTC ETF/GLD/TLT), cobertura de
UE/UK/Austrália/NZ/Suíça/China, calendário macro completo (CPI/payroll/PIB) — hoje só cobre
bancos centrais + geopolítica.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencher DATABASE_URL (Supabase, projeto novo e separado)
npm run db:push
npm run dev
```

Popule dados manualmente batendo nos crons:

```bash
curl http://localhost:3000/api/cron/ingest-events
curl http://localhost:3000/api/cron/ingest-flows
```

## Variáveis de ambiente

- `DATABASE_URL` — Postgres (Supabase), projeto **separado** do Terminal de Mercado.
- `CRON_SECRET` — protege `/api/cron/*` em produção (Vercel Cron manda esse header).

## Deploy

Vercel + Supabase, mesmo padrão do outro projeto. `vercel.json` já define os crons
(`ingest-events` a cada 6h, `ingest-flows` 1x/dia).
