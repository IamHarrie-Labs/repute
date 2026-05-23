// Simple static file server for the Repute web app
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".jsx": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

createServer((req, res) => {
  let pathname = req.url.split("?")[0];

  // Route / → landing page, /app → dashboard
  if (pathname === "/") pathname = "/landing.html";
  else if (pathname === "/app" || pathname === "/app/") pathname = "/index.html";

  const filePath = join(__dirname, pathname);
  const ext = extname(filePath);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (!existsSync(filePath)) {
    res.writeHead(404).end("Not found: " + pathname);
    return;
  }

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(content);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => {
  console.log(`[web] Repute UI → http://localhost:${PORT}`);
});
