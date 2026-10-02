import { sanitizeModelPatch, type ConstraintPatch, type ShoppingConstraints } from "./constraints";

const SCHEMA = {
  type: "object",
  properties: {
    productQuery: { type: "string" },
    addColors: { type: "array", items: { type: "string" } },
    replaceColors: { type: "boolean" },
    clearColors: { type: "boolean" },
    addSizes: { type: "array", items: { type: "string" } },
    replaceSizes: { type: "boolean" },
    clearSizes: { type: "boolean" },
    maxPriceCents: { type: "integer" },
    clearMaxPrice: { type: "boolean" },
    condition: { type: "string", enum: ["any", "new", "used"] },
    shipToCountry: { type: "string" },
    isNewSearch: { type: "boolean" },
  },
  required: ["isNewSearch"],
};

export class GeminiBusyError extends Error {
  constructor() {
    super("Gemini is temporarily busy.");
    this.name = "GeminiBusyError";
  }
}

export async function extractConstraintPatch(input: {
  apiKey: string;
  model: string;
  message: string;
  current: ShoppingConstraints;
  history: { role: string; text: string }[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ConstraintPatch | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const sleep = input.sleep ?? delay;
  let attempt = 0;
  while (attempt < 2) {
    const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        model: input.model,
        input: promptFor(input.message, input.current, input.history),
        store: false,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (await isExhausted(response)) {
      const wait = retryAfterMs(response);
      if (attempt === 0 && (wait == null || wait <= 1_500)) {
        await sleep(wait ?? 400);
        attempt += 1;
        continue;
      }
      throw new GeminiBusyError();
    }
    if (!response.ok) return null;
    const body = await response.json() as unknown;
    const text = extractOutputText(body);
    if (!text) return null;
    try {
      return sanitizeModelPatch(JSON.parse(text));
    } catch {
      return null;
    }
  }
  throw new GeminiBusyError();
}

async function isExhausted(response: Response): Promise<boolean> {
  if (response.status === 429) return true;
  if (response.ok) return false;
  const text = await response.clone().text();
  return text.includes("RESOURCE_EXHAUSTED");
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractOutputText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) return record.output_text;
  const fromSteps = textFromModelSteps(record.steps);
  if (fromSteps) return fromSteps;
  return textFromLegacyOutputs(record.outputs ?? record.output);
}

function textFromModelSteps(steps: unknown): string | null {
  if (!Array.isArray(steps)) return null;
  let text: string | null = null;
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const typed = step as { type?: unknown; content?: unknown };
    if (typed.type !== "model_output") continue;
    const next = joinTextBlocks(typed.content);
    if (next) text = next;
  }
  return text;
}

function textFromLegacyOutputs(outputs: unknown): string | null {
  if (typeof outputs === "string" && outputs.trim()) return outputs;
  if (!Array.isArray(outputs)) return null;
  const chunks: string[] = [];
  for (const part of outputs) {
    if (typeof part === "string") chunks.push(part);
    else if (part && typeof part === "object") {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  const joined = chunks.join("").trim();
  return joined.length > 0 ? joined : null;
}

function joinTextBlocks(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const chunks: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const typed = block as { type?: unknown; text?: unknown };
    if (typed.type !== "text" || typeof typed.text !== "string") continue;
    chunks.push(typed.text);
  }
  const joined = chunks.join("").trim();
  return joined.length > 0 ? joined : null;
}

function promptFor(message: string, current: ShoppingConstraints, history: { role: string; text: string }[]): string {
  return [
    "You extract shopping constraints for SuperTab.",
    "Do not invent products, prices, merchants, balances, or links.",
    "Return only constraint changes from the shopper's latest message.",
    "Keep earlier hard constraints unless the shopper changes them.",
    "maxPriceCents is US cents. Never guess a price that was not stated.",
    "isNewSearch is true only when the shopper asks for a different product search.",
    `Current constraints: ${JSON.stringify(serializeConstraints(current))}`,
    `Recent conversation: ${JSON.stringify(history.slice(-6))}`,
    `Latest message: ${message}`,
  ].join("\n");
}

function serializeConstraints(constraints: ShoppingConstraints) {
  return {
    productQuery: constraints.productQuery,
    colors: constraints.colors,
    sizes: constraints.sizes,
    maxPriceCents: constraints.maxPriceCents?.toString() ?? null,
    condition: constraints.condition,
    shipToCountry: constraints.shipToCountry,
  };
}
