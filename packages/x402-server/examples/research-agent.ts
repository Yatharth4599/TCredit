import { createX402Server } from "../src/index.js";

const AGENT_PUBKEY = process.env.AGENT_PUBKEY || "YOUR_AGENT_PUBKEY";
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS || "REVENUE_ROUTER_TOKEN_ACCOUNT";

const { app, addPaidEndpoint } = createX402Server({
  agentPubkey: AGENT_PUBKEY,
  revenueRouterAddress: ROUTER_ADDRESS,
  network: "devnet",
});

addPaidEndpoint({
  path: "/api/research",
  method: "GET",
  priceUsdc: "0.25",
  description: "AI-powered research query",
  handler: async (req, res) => {
    const query = req.query.q as string || "default query";
    res.json({
      query,
      result: `Research result for: "${query}"`,
      payment: {
        amount: "0.25 USDC",
        routed: true,
        note: "Payment auto-split via Krexa Revenue Router",
      },
    });
  },
});

addPaidEndpoint({
  path: "/api/summarize",
  method: "POST",
  priceUsdc: "0.10",
  description: "Text summarization",
  handler: async (req, res) => {
    const text = req.body?.text || "";
    res.json({
      summary: `Summary of ${text.length} chars: ${text.slice(0, 100)}...`,
      payment: { amount: "0.10 USDC", routed: true },
    });
  },
});

const port = parseInt(process.env.PORT || "3402");
app.listen(port, () => {
  console.log(`x402 Research Agent running on port ${port}`);
  console.log(`Agent: ${AGENT_PUBKEY}`);
  console.log(`Revenue Router: ${ROUTER_ADDRESS}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/research?q=...  ($0.25 USDC)`);
  console.log(`  POST /api/summarize       ($0.10 USDC)`);
  console.log(`  GET  /.well-known/x402    (discovery)`);
  console.log(`  GET  /health              (health check)`);
});
