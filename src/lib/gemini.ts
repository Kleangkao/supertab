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

export async function extractConstraintPatch(input: {
  apiKey: string;
  model: string;
  message: string;
  current: ShoppingConstraints;
  history: { role: string; text: string }[];
  fetchImpl?: typeof fetch;
}): Promise<ConstraintPatch | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify({
      model: input.model,
      input: promptFor(input.message, input.current, input.history),
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });
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

export function extractOutputText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  const outputs = record.outputs ?? record.output;
  if (typeof outputs === "string") return outputs;
  if (Array.isArray(outputs)) {
    for (const part of outputs) {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const text = (part as { text?: unknown; content?: unknown }).text
          ?? (part as { content?: { text?: unknown } }).content?.text;
        if (typeof text === "string") return text;
      }
    }
  }
  return null;
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
