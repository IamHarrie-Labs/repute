# @repute/mcp

Repute as an MCP server — plug trust-score tools directly into Claude Code or any MCP-compatible agent framework.

## What it does

Once registered, your AI agent can call Repute tools natively, in natural language or in tool-use chains, without writing any integration code.

```
User: "Which merchants are safe to pay right now?"
Claude: [calls repute_leaderboard(safe_only: true)] → returns top trusted merchants
```

## Tools

| Tool | Description |
|---|---|
| `repute_score` | Full trust profile for one merchant — verdict, score, flags, latency, price |
| `repute_batch` | Score up to 20 addresses in one call |
| `repute_leaderboard` | All merchants sorted by trust score, filterable to safe-only |
| `repute_stats` | Network totals — payments, merchants, 24h volume, fraud alerts |
| `repute_feed` | Recent indexed payments with delivery status and trust context |
| `repute_subscribe` | Register a webhook URL for fraud flag alerts |

## Setup — Claude Code

Add to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "repute": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "/absolute/path/to/packages/mcp/src/index.ts"
      ],
      "env": {
        "REPUTE_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

Then restart Claude Code. The tools appear automatically.

## Setup — Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "repute": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "C:/path/to/packages/mcp/src/index.ts"
      ],
      "env": {
        "REPUTE_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

## Run standalone

```bash
REPUTE_API_URL=http://localhost:3001 pnpm --filter @repute/mcp dev
```

## Example agent usage

```typescript
// Your agent, using Claude API with MCP
// Claude will automatically call repute_score before paying

const response = await anthropic.messages.create({
  model: "claude-opus-4-5",
  tools: [], // Repute tools injected via MCP — no manual wiring
  messages: [{
    role: "user",
    content: `Check if merchant 0x15481D7B... is safe to pay, then send $0.001 USDC if it is.`
  }]
});
// Claude calls repute_score, reads verdict: SAFE_TO_PAY, then executes payment
```

## Verdict logic

| Verdict | Condition |
|---|---|
| `SAFE_TO_PAY` | trust_score ≥ 75 and no fraud_flag |
| `DO_NOT_PAY` | fraud_flag is set (ghost / flaky / rugger) |
| `CAUTION` | trust_score < 75 and no fraud flag |

## Built on

- **MCP SDK** — `@modelcontextprotocol/sdk`
- **@repute/sdk** — workspace package
- **Arc Testnet** — chain ID 5042002, USDC native
