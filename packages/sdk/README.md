# @repute/sdk

Trust scores for autonomous agent commerce on Arc.

Query merchant reputation before spending USDC — one line, one decision.

## Install

```bash
npm install @repute/sdk
# or
pnpm add @repute/sdk
```

## Quick start

```typescript
import { Repute } from '@repute/sdk';

const repute = new Repute({ baseUrl: 'http://localhost:3001' });

// Query a merchant's trust score before paying
const score = await repute.score('0x15481D7B...');

console.log(score.trust_score);  // 0–100
console.log(score.verdict);      // "SAFE_TO_PAY" | "CAUTION" | "DO_NOT_PAY"

if (score.verdict === 'SAFE_TO_PAY') {
  await circleTransferUsdc(walletId, score.address, score.price_per_call);
}
```

## API

### `new Repute(config?)`

| Option | Default | Description |
|---|---|---|
| `baseUrl` | `http://localhost:3001` | Repute API endpoint |
| `paymentProof` | — | x402 tx hash for live mode |
| `callerAddress` | — | Your agent's address (logged against paid queries) |

### `.score(address)` → `ScoreResult`
Full trust profile for one merchant. Costs **$0.0001 USDC** (bypassed in DEMO_MODE).

### `.batchScore(addresses[])` → `{ scores[] }`
Up to 20 addresses in one call. Costs **$0.0005 USDC**.

### `.leaderboard()` → `{ merchants[] }`
All merchants sorted by trust score. Free.

### `.stats()` → `NetworkStats`
Network totals: payments indexed, merchant count, 24h volume. Free.

### `.feed(limit?)` → `{ payments[] }`
Recent indexed payments with merchant + score context. Free.

### `.battle()` → `BattleStats`
Live NaiveAgent vs ReputeAgent benchmark. Free.

### `.subscribe(url, events?, label?)` → `WebhookRegistration`
Register a webhook URL to receive fraud flag events.

```typescript
await repute.subscribe('https://myagent.xyz/hooks/repute', ['fraud_flag']);
// Your URL receives: POST { event, payload: { merchant, fraud_flag, trust_score, ... } }
```

### `.stream(onPayment)` → `close()`
SSE stream — calls `onPayment` for every new indexed payment.

```typescript
const close = repute.stream(payment => {
  console.log(payment.merchant_name, payment.amount_usdc, payment.delivered);
});
// later:
close();
```

## Verdict logic

| Verdict | Condition |
|---|---|
| `SAFE_TO_PAY` | `trust_score >= 75` and no `fraud_flag` |
| `DO_NOT_PAY` | `fraud_flag` is set (ghost / flaky / rugger) |
| `CAUTION` | `trust_score < 75` and no fraud flag |

## Built on

- **Arc Testnet** — chain ID 5042002, USDC native
- **Circle Developer-Controlled Wallets** — payment execution
- **x402 protocol** — pay-per-query API access
