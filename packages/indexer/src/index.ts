import "dotenv/config";
import { openDb, initDb } from "./db.ts";
import { startArcWatcher } from "./watcher.ts";
import { startSimulator } from "./simulator.ts";

const db = openDb();
initDb(db);

const mode = process.env.INDEXER_MODE ?? "simulate";

console.log(`[indexer] starting in ${mode} mode`);

if (mode === "arc") {
  startArcWatcher(db);
} else {
  startSimulator(db);
}
