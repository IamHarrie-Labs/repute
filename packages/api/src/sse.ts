import type { Context } from "hono";
import type Database from "better-sqlite3";

/**
 * Server-Sent Events stream for the live feed.
 * Frontend connects once; receives new payments as they land in DB.
 * The frontend dashboard hits GET /feed/stream to get real-time rows.
 */
export function sseHandler(db: Database.Database) {
  return (c: Context) => {
    let lastId = (db.prepare(`SELECT MAX(id) AS id FROM payments`).get() as any)?.id ?? 0;

    const stream = new ReadableStream({
      start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        // Send initial snapshot (last 20)
        const initial = db.prepare(`
          SELECT p.*, m.name AS merchant_name, m.category, s.trust_score
          FROM payments p
          LEFT JOIN merchants m ON p.merchant = m.address
          LEFT JOIN scores    s ON p.merchant = s.merchant
          WHERE p.id <= ?
          ORDER BY p.timestamp DESC
          LIMIT 20
        `).all(lastId);
        send({ type: "snapshot", payments: initial.reverse() });

        // Poll DB every second for new rows
        const interval = setInterval(() => {
          const rows = db.prepare(`
            SELECT p.*, m.name AS merchant_name, m.category, s.trust_score
            FROM payments p
            LEFT JOIN merchants m ON p.merchant = m.address
            LEFT JOIN scores    s ON p.merchant = s.merchant
            WHERE p.id > ?
            ORDER BY p.id ASC
          `).all(lastId);

          if (rows.length > 0) {
            lastId = (rows[rows.length - 1] as any).id;
            send({ type: "payments", payments: rows });
          }
        }, 1000);

        // Clean up on disconnect
        c.req.raw.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  };
}
