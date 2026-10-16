# Verification checklist

Before release:

- [ ] `npm install`
- [ ] `npm run check`
- [ ] `npm run build`
- [ ] Start the server and verify `GET /health`
- [ ] Connect an MCP client to `https://YOUR-HOST/mcp`
- [ ] Verify tool discovery and call `search_mobile_supabase_knowledge`
- [ ] Configure Supabase schema and confirm reads work
- [ ] Confirm no secrets are committed to GitHub
- [ ] Test approval wording with a consequential proposed action
- [ ] Submit current Android Chrome screenshots and verify UI observations before marking them `verified`
