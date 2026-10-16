# Mobile-First Supabase Knowledge MCP

A starter MCP server focused on helping people use the **Supabase Dashboard in Chrome on Android**. It keeps mobile UI guidance separate from desktop guidance and records confidence/source metadata so the assistant can avoid inventing button locations.

## Important limits

- Dashboard layouts can vary by viewport, account permissions, rollout, and product updates. Treat UI positions as verified only when supported by a recent screenshot or source.
- This starter does not scrape the private Dashboard, inspect your phone, or claim that every button location is current.
- The server asks for confirmation by returning a proposed plan. The AI client must obtain your approval before performing consequential actions.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Keep it server-side only; never commit it.

## Tools exposed

- `search_mobile_supabase_knowledge`: search UI and technical guidance, prioritizing Android Chrome.
- `propose_change_plan`: produce a plan and require explicit approval before consequential work.
- `review_code`: checklist-based second-pass review of code supplied by the caller.
- `record_ui_observation`: save a user-observed menu/button location, marked as unverified until reviewed.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm run dev
```

The HTTP MCP endpoint is `/mcp`. Health endpoint: `/health`.

For a local test from a phone, the server must be reachable from the phone's network. For a hosted connector, deploy to a public HTTPS host and configure the MCP URL as `https://YOUR-HOST/mcp`.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your host environment.
4. Use a server-side service role key only if you intentionally need privileged writes. Prefer the anon key with carefully designed RLS for public-facing access.

The server gracefully falls back to a small built-in starter knowledge set if Supabase environment variables are not configured.

## GitHub deployment

Push this project to a GitHub repository. GitHub stores the source; it does not itself run a persistent MCP server. Deploy the repository to a Node-compatible host that supports HTTPS and long-lived HTTP requests, then use the deployed `/mcp` URL in your connector.

## Safety model

The MCP tools do not execute SQL, modify projects, or mutate Dashboard settings. They provide knowledge, proposals, and review. If future write-capable tools are added, implement a separate approval token, authorization, audit log, and server-side allowlist before enabling them.

## Add accurate mobile knowledge

Use `record_ui_observation` after checking the actual current Android Chrome UI. Include the page, visible menu labels, viewport notes, date, and source. Treat user-submitted observations as unverified until checked against a current screenshot or official source.
