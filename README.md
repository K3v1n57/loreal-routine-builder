# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Local development guide

To run the project locally and keep your OpenAI key secret, you can use the included minimal Node proxy.

1. Copy `.env.example` to `.env` and set your OpenAI API key:

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY
```

2. Start the local proxy (requires Node 18+):

```bash
OPENAI_API_KEY="sk-..." node server.js
```

The client will automatically use `http://localhost:8787/api/openai` when served from `localhost`.

3. Open `index.html` with Live Server or any static server and test the "Generate routine" flow.

If you deploy the Cloudflare Worker, set `OPENAI_API_KEY` in the worker environment and set `window.WORKER_URL` or update `WORKER_URL` in `script.js` to point to your worker endpoint.

Debugging tips:

- Inspect the Network tab to see the POST to `/api/openai`. The worker forwards OpenAI's JSON including any `error` field.
- If you see CORS/preflight errors, ensure the proxy or worker responds to OPTIONS and returns CORS headers.
