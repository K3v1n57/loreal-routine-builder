// Minimal Node HTTP proxy for OpenAI (no npm required).
// Run with: OPENAI_API_KEY="sk-..." node server.js
// Note: requires Node 18+ (global fetch available).

const http = require("http");

const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error(
    'Missing OPENAI_API_KEY. Start with: OPENAI_API_KEY="sk-..." node server.js'
  );
  process.exit(1);
}

// simple helper to read request body as JSON
async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // enable CORS for local dev - adjust origin for production
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === "/api/openai" && req.method === "POST") {
    try {
      const payload = await readJson(req);
      const messages = payload.messages;
      const model = payload.model || "gpt-4o";
      if (!Array.isArray(messages)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "messages must be an array" }));
      }

      const openaiRes = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: payload.temperature ?? 0.7,
            max_tokens: payload.max_tokens ?? 800,
          }),
        }
      );

      const data = await openaiRes.json();
      res.writeHead(openaiRes.status, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(data));
    } catch (err) {
      console.error("Proxy error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: String(err) }));
    }
  }

  // not found
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`OpenAI proxy listening on http://localhost:${PORT}/api/openai`);
});
