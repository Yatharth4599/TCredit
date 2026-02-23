# Future: Trained Chatbot Agent (OpenRouter + stronger models)

**Add this as section 7 to the x402 + Consultant plan.** One agent used for (a) human-facing chatbot across tpayx services (support, onboarding, vault Q&A), and (b) the consultant API that other agents pay via x402. Use **OpenRouter** for inference so you get access to top-tier models (GPT-4, Claude, etc.) without hosting; optional local fallback or fine-tuning can be added later.

---

## Role of the agent

- **Human users:** Chatbot in the app (merchant/investor support, product knowledge, vault explanations).
- **Other agents:** Consultant endpoint backed by the same model (x402-paid); responses stay on-brand and informed by the same training.
- **Training once** covers both; the consultant is just another interface to the same agent.

---

## Recommended “training” / customization (with OpenRouter)

- **Primary approach:** Use **RAG (retrieval-augmented generation)** plus **system prompts** and **few-shot examples**. OpenRouter models are strong out of the box; you get “training” by injecting vault docs, FAQ, and product copy per query and by defining persona/behavior in the system prompt. No GPU or local hosting required.
- **Optional fine-tuning:** If you need a custom model later, use provider fine-tuning (e.g. OpenAI fine-tuning, or Anthropic’s custom model programs) or run **LoRA/QLoRA** on an open model (e.g. Llama) and either self-host or use a provider that serves custom adapters. For most chatbot + consultant use cases, RAG + prompts are enough.
- **Suggested stack:** Backend calls [OpenRouter API](https://openrouter.ai/docs) (single API key, 400+ models). Add a RAG layer (e.g. vector DB + embeddings) for vault/product knowledge. Version and tune system prompts and few-shot examples in code or config.

---

## Recommended LLM: OpenRouter (stronger models, no local hosting)

- **Provider:** [OpenRouter](https://openrouter.ai) — one API for 400+ models. No local GPU; you call their API from your backend. Pay per token; [pricing](https://openrouter.ai/pricing) is per million tokens (input/output). Stronger quality than typical local 7B/13B setups.
- **Model choices (via OpenRouter; pick by quality/cost):**
  - **Top tier (best quality):** `anthropic/claude-sonnet-4`, `openai/gpt-4o`, `openai/gpt-4o-mini`, `google/gemini-2.0-flash-exp` — use for chatbot and consultant when you want best reasoning and tone.
  - **Strong + cheaper:** `anthropic/claude-3.5-haiku`, `openai/gpt-4o-mini`, `meta-llama/llama-3.3-70b-instruct` — good balance of cost and quality for high volume.
  - **Open / flexible:** `meta-llama/llama-3.3-70b-instruct`, `mistralai/mistral-large`, `deepseek/deepseek-chat` — strong open or mid-tier options.
- **Integration:** Backend sends requests to `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible). Set `HTTP-Referer` (and optional `X-Title`) for your app; use a single API key. Switch models by changing the `model` field (no code change to your prompt shape).

---

## Hardware / ops (OpenRouter-first)

- **Inference:** No local GPU needed. Your backend (e.g. Node/Python) calls OpenRouter over HTTPS. Any machine that runs your API (e.g. 1 vCPU, 512MB–1GB RAM per process) is enough; scale by request volume.
- **Cost:** OpenRouter is pay-per-token. Budget by expected messages per user and tokens per message; use `gpt-4o-mini` or `claude-3.5-haiku` for high volume, reserve stronger models (e.g. `gpt-4o`, `claude-sonnet-4`) for consultant or premium flows if you want.
- **Optional local / fine-tuning later:** If you add a local fallback or your own fine-tuned model (e.g. LoRA on Llama), then you’d need GPU hardware as in the earlier “Future” doc (e.g. 16–24GB VRAM for 7–13B). Not required when using OpenRouter as the primary inference.
