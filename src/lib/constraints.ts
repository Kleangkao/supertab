export type ItemCondition = "any" | "new" | "used";

export const SHOPPING_MESSAGE_LIMIT = 500;

export interface ShoppingConstraints {
  productQuery: string;
  requiredTerms: string[];
  colors: string[];
  sizes: string[];
  maxPriceCents: bigint | null;
  condition: ItemCondition;
  merchantIncludes: string[];
  shipToCountry: string | null;
}

export interface ConstraintPatch {
  productQuery?: string;
  addColors?: string[];
  replaceColors?: boolean;
  clearColors?: boolean;
  addSizes?: string[];
  replaceSizes?: boolean;
  clearSizes?: boolean;
  maxPriceCents?: bigint | null;
  clearMaxPrice?: boolean;
  condition?: ItemCondition;
  shipToCountry?: string | null;
  isNewSearch?: boolean;
}

export const COLORS = [
  "black",
  "white",
  "navy",
  "blue",
  "red",
  "green",
  "grey",
  "gray",
  "brown",
  "pink",
  "purple",
  "orange",
  "yellow",
  "beige",
  "cream",
  "gold",
  "silver",
];

const STOPWORDS = new Set([
  "a", "an", "the", "me", "my", "for", "to", "of", "and", "or", "with", "please",
  "find", "show", "looking", "look", "want", "need", "get", "some", "pair", "pairs",
  "under", "below", "size", "color", "colour", "in", "is", "fine", "too", "also",
  "instead", "just", "buy", "search", "i", "im", "am", "would", "like", "shop",
  "shopping", "can", "you", "actually", "but", "ok", "okay", "well", "ones", "one",
  "those", "these", "make", "it", "them", "that", "this", "from", "any", "not",
]);

export function emptyConstraints(): ShoppingConstraints {
  return {
    productQuery: "",
    requiredTerms: [],
    colors: [],
    sizes: [],
    maxPriceCents: null,
    condition: "any",
    merchantIncludes: [],
    shipToCountry: null,
  };
}

export function cloneConstraints(value: ShoppingConstraints): ShoppingConstraints {
  return {
    ...value,
    requiredTerms: [...value.requiredTerms],
    colors: [...value.colors],
    sizes: [...value.sizes],
    merchantIncludes: [...value.merchantIncludes],
  };
}

export function isNewShoppingRequest(message: string): boolean {
  return /^\s*(please\s+)?(find|search|show|look(?:ing)?(?:\s+for)?|i(?:'m| am)?\s+(?:looking|want|need)|get me|can you find)\b/i.test(
    message,
  );
}

export function mergeConstraints(current: ShoppingConstraints, message: string): ShoppingConstraints {
  const fresh = isNewShoppingRequest(message);
  const next = fresh
    ? { ...emptyConstraints(), shipToCountry: current.shipToCountry }
    : cloneConstraints(current);

  if (clearsBudget(message)) next.maxPriceCents = null;
  else {
    const price = extractMaxPriceCents(message);
    if (price != null) next.maxPriceCents = price;
  }

  const droppingColor = !fresh && /^\s*not\s+(?!size\b)/i.test(message);
  const droppingSize = !fresh && /^\s*not size\b/i.test(message);
  const colors = droppingColor || droppingSize ? [] : extractColors(message);
  const colorMode = listUpdateMode(message, colors.length > 0, "colou?r");
  if (droppingColor) next.colors = next.colors.filter((color) => !extractColors(message).includes(color));
  else if (colorMode === "clear") next.colors = [];
  else if (colorMode === "replace" || fresh) next.colors = colors;
  else next.colors = unique([...next.colors, ...colors]);

  const sizes = droppingSize ? [] : extractSizes(message);
  const sizeMode = listUpdateMode(message, sizes.length > 0, "size");
  if (droppingSize) next.sizes = next.sizes.filter((size) => !extractSizes(message).includes(size));
  else if (sizeMode === "clear") next.sizes = [];
  else if (sizeMode === "replace" || fresh) next.sizes = sizes;
  else next.sizes = unique([...next.sizes, ...sizes]);

  const condition = /\bany condition\b/i.test(message) ? "any" : extractCondition(message);
  if (condition) next.condition = condition;
  else if (fresh) next.condition = "any";

  const ship = extractShipCountry(message);
  if (ship) next.shipToCountry = ship;

  const merchants = extractMerchants(message);
  if (fresh) next.merchantIncludes = merchants;
  else if (merchants.length > 0) next.merchantIncludes = unique([...next.merchantIncludes, ...merchants]);

  const product = extractProductQuery(message);
  if (fresh || ((replacesProduct(message) || !next.productQuery) && product)) {
    next.productQuery = product;
  }
  next.requiredTerms = significantTerms(next.productQuery);
  return next;
}

/**
 * Gemini may propose a patch. Explicit amounts, colors, and sizes in the
 * shopper's words stay in force. The model cannot raise a budget or drop a
 * hard constraint the deterministic read still holds.
 */
export function resolveConstraints(
  current: ShoppingConstraints,
  message: string,
  modelPatch: ConstraintPatch | null,
): ShoppingConstraints {
  const deterministic = mergeConstraints(current, message);
  if (!modelPatch) return deterministic;

  const base = modelPatch.isNewSearch || isNewShoppingRequest(message)
    ? { ...emptyConstraints(), shipToCountry: current.shipToCountry }
    : cloneConstraints(current);
  const modeled = applyPatch(base, modelPatch);
  return {
    productQuery: deterministic.productQuery || modeled.productQuery,
    requiredTerms: unique([
      ...significantTerms(deterministic.productQuery || modeled.productQuery),
    ]),
    colors: lockList(deterministic.colors, modeled.colors, message),
    sizes: lockList(deterministic.sizes, modeled.sizes, message),
    maxPriceCents: lockPrice(deterministic.maxPriceCents, modeled.maxPriceCents, message),
    condition: conditionMentioned(message) ? deterministic.condition : modeled.condition || deterministic.condition,
    merchantIncludes: deterministic.merchantIncludes.length > 0
      ? deterministic.merchantIncludes
      : modeled.merchantIncludes,
    shipToCountry: shipMentioned(message) ? deterministic.shipToCountry : modeled.shipToCountry ?? deterministic.shipToCountry,
  };
}

export function applyPatch(current: ShoppingConstraints, patch: ConstraintPatch): ShoppingConstraints {
  const next = cloneConstraints(current);
  if (patch.clearColors) next.colors = [];
  else if (patch.replaceColors && patch.addColors) next.colors = unique(patch.addColors.map(normalizeToken));
  else if (patch.addColors) next.colors = unique([...next.colors, ...patch.addColors.map(normalizeToken)]);

  if (patch.clearSizes) next.sizes = [];
  else if (patch.replaceSizes && patch.addSizes) next.sizes = unique(patch.addSizes.map((size) => size.trim()));
  else if (patch.addSizes) next.sizes = unique([...next.sizes, ...patch.addSizes.map((size) => size.trim())]);

  if (patch.clearMaxPrice) next.maxPriceCents = null;
  else if (patch.maxPriceCents != null) next.maxPriceCents = patch.maxPriceCents;

  if (patch.condition) next.condition = patch.condition;
  if (patch.shipToCountry) next.shipToCountry = patch.shipToCountry.toUpperCase();
  if (patch.productQuery && patch.productQuery.trim()) {
    next.productQuery = patch.productQuery.trim().toLowerCase();
    next.requiredTerms = significantTerms(next.productQuery);
  }
  return next;
}

export function sanitizeModelPatch(value: unknown): ConstraintPatch | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const patch: ConstraintPatch = {};
  if (typeof record.productQuery === "string") patch.productQuery = record.productQuery.slice(0, 120);
  if (Array.isArray(record.addColors)) patch.addColors = stringList(record.addColors);
  if (record.replaceColors === true) patch.replaceColors = true;
  if (record.clearColors === true) patch.clearColors = true;
  if (Array.isArray(record.addSizes)) patch.addSizes = stringList(record.addSizes);
  if (record.replaceSizes === true) patch.replaceSizes = true;
  if (record.clearSizes === true) patch.clearSizes = true;
  if (typeof record.maxPriceCents === "number" && Number.isSafeInteger(record.maxPriceCents) && record.maxPriceCents >= 0) {
    patch.maxPriceCents = BigInt(record.maxPriceCents);
  }
  if (record.clearMaxPrice === true) patch.clearMaxPrice = true;
  if (record.condition === "any" || record.condition === "new" || record.condition === "used") {
    patch.condition = record.condition;
  }
  if (typeof record.shipToCountry === "string" && /^[A-Za-z]{2}$/.test(record.shipToCountry)) {
    patch.shipToCountry = record.shipToCountry.toUpperCase();
  }
  if (record.isNewSearch === true) patch.isNewSearch = true;
  return patch;
}

export function buildSearchQuery(constraints: ShoppingConstraints): string {
  const parts = [
    constraints.productQuery,
    constraints.colors.join(" "),
    constraints.sizes.map((size) => `size ${size}`).join(" "),
  ].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function describeConstraints(constraints: ShoppingConstraints): string {
  const bits: string[] = [];
  if (constraints.productQuery) bits.push(constraints.productQuery);
  if (constraints.colors.length > 0) bits.push(constraints.colors.join(" or "));
  if (constraints.sizes.length > 0) bits.push(`size ${constraints.sizes.join(" or ")}`);
  if (constraints.maxPriceCents != null) bits.push(`at or under ${formatCents(constraints.maxPriceCents)}`);
  if (constraints.condition !== "any") bits.push(constraints.condition);
  if (constraints.shipToCountry) bits.push(`destination filter ${constraints.shipToCountry}, not a delivery promise`);
  return bits.join(", ");
}

export type RequirementChange =
  | { kind: "clear-budget" }
  | { kind: "set-budget"; dollars: string }
  | { kind: "add-color"; color: string }
  | { kind: "replace-color"; color: string }
  | { kind: "remove-color"; color: string }
  | { kind: "clear-colors" }
  | { kind: "add-size"; size: string }
  | { kind: "replace-size"; size: string }
  | { kind: "remove-size"; size: string }
  | { kind: "clear-sizes" }
  | { kind: "condition"; condition: ItemCondition }
  | { kind: "ship"; country: "US" | "TH" | "GB" };

/** Controls submit the same sentences the conversation parser already understands. */
export function requirementMessage(change: RequirementChange): string {
  switch (change.kind) {
    case "clear-budget": return "any budget";
    case "set-budget": return `under $${change.dollars}`;
    case "add-color": return `${change.color} is fine too`;
    case "replace-color": return `${change.color} only`;
    case "remove-color": return `not ${change.color}`;
    case "clear-colors": return "any color";
    case "add-size": return `size ${change.size} is fine too`;
    case "replace-size": return `size ${change.size} only`;
    case "remove-size": return `not size ${change.size}`;
    case "clear-sizes": return "any size";
    case "condition":
      return change.condition === "any" ? "any condition" : change.condition === "new" ? "brand new" : "used";
    case "ship":
      return change.country === "TH" ? "ship to thailand" : change.country === "GB" ? "ship to uk" : "ship to united states";
  }
}

function formatCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");
  return `$${whole}.${fraction}`;
}

function lockPrice(deterministic: bigint | null, modeled: bigint | null, message: string): bigint | null {
  if (priceMentioned(message) || clearsBudget(message)) return deterministic;
  return deterministic ?? modeled;
}

function lockList(deterministic: string[], modeled: string[], message: string): string[] {
  const mentioned = modeled
    .map(normalizeToken)
    .filter((token) => token.length > 0 && message.toLowerCase().includes(token.toLowerCase()));
  return unique([...deterministic, ...mentioned]);
}

function clearsBudget(message: string): boolean {
  return /\b(any budget|no budget|remove (?:the )?budget|no price limit)\b/i.test(message);
}

function priceMentioned(message: string): boolean {
  return /(?:under|below|less than|max(?:imum)?|budget|\$)\s*\$?\s*\d+/i.test(message) || /\$\s*\d+/.test(message);
}

export function extractMaxPriceCents(message: string): bigint | null {
  const match = message.match(
    /(?:under|below|less than|max(?:imum)?|budget(?:\s+of)?|for)\s*\$?\s*(\d+(?:\.\d{1,2})?)|\$\s*(\d+(?:\.\d{1,2})?)\s*(?:or less|max|budget)?|(\d+(?:\.\d{1,2})?)\s*dollars?/i,
  );
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!raw) return null;
  const [whole, fraction = ""] = raw.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  return cents;
}

function extractColors(message: string): string[] {
  const found: string[] = [];
  const lower = message.toLowerCase();
  for (const color of COLORS) {
    const pattern = new RegExp(`(^|[^a-z])${color}([^a-z]|$)`, "i");
    if (pattern.test(lower)) found.push(color === "grey" ? "gray" : color);
  }
  return unique(found);
}

function extractSizes(message: string): string[] {
  const withoutPrice = message.replace(
    /(?:under|below|less than|max(?:imum)?|budget(?:\s+of)?|for)\s*\$?\s*\d+(?:\.\d{1,2})?|\$\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*dollars?/gi,
    " ",
  );
  const found: string[] = [];
  const numeric = /(?:\bsize|\beu|\bus|\buk)\s*#?\s*(\d{1,2}(?:\.\d)?)\b/gi;
  for (const match of withoutPrice.matchAll(numeric)) {
    if (match[1]) found.push(match[1]);
  }
  const words = /\bsize\s+(xxxl|xxl|xl|xxs|xs|small|medium|large|s|m|l)\b/gi;
  for (const match of withoutPrice.matchAll(words)) {
    if (match[1]) found.push(match[1].toLowerCase());
  }
  return unique(found);
}

function extractCondition(message: string): ItemCondition | null {
  if (/\b(brand[\s-]?new|condition\s*[:=]?\s*new|new only)\b/i.test(message)) return "new";
  if (/\b(used|second[\s-]?hand|pre[\s-]?owned|refurbished)\b/i.test(message)) return "used";
  return null;
}

function extractShipCountry(message: string): string | null {
  const match = message.match(/\bship(?:ping)?\s+to\s+([A-Za-z]{2}|thailand|united states|usa|uk)\b/i);
  if (!match?.[1]) return null;
  const token = match[1].toLowerCase();
  if (token === "thailand") return "TH";
  if (token === "united states" || token === "usa") return "US";
  if (token === "uk") return "GB";
  return token.toUpperCase();
}

function extractMerchants(message: string): string[] {
  const match = message.match(/\b(?:from|sold by|merchant)\s+([A-Za-z0-9][A-Za-z0-9 &'-]{1,40})/);
  if (!match?.[1]) return [];
  return [match[1].trim()];
}

function extractProductQuery(message: string): string {
  let text = message.toLowerCase();
  text = text.replace(/^\s*(please\s+)?(find me|find|search for|search|show me|show|look(?:ing)? for|i(?:'m| am)? looking for|i want|i need|get me|can you find)\b/i, " ");
  text = text.replace(/(?:under|below|less than|max(?:imum)?|budget(?:\s+of)?)\s*\$?\s*\d+(?:\.\d{1,2})?/gi, " ");
  text = text.replace(/\$\s*\d+(?:\.\d{1,2})?/g, " ");
  text = text.replace(/\d+(?:\.\d{1,2})?\s*dollars?/gi, " ");
  text = text.replace(/\b(?:size|eu|us|uk)\s*#?\s*\d{1,2}(?:\.\d)?\b/gi, " ");
  text = text.replace(/\bsize\s+(?:xxxl|xxl|xl|xxs|xs|small|medium|large|s|m|l)\b/gi, " ");
  text = text.replace(/\bship(?:ping)?\s+to\s+[a-z]{2,}\b/gi, " ");
  text = text.replace(/\b(refurbished|pre-?owned|second[\s-]?hand|secondhand)\b/gi, " ");
  for (const color of COLORS) {
    text = text.replace(new RegExp(`(^|[^a-z])${color}([^a-z]|$)`, "gi"), " ");
  }
  text = text.replace(/[^a-z0-9\s-]/g, " ");
  const words = text.split(/\s+/).filter((word) => word.length > 1 && !STOPWORDS.has(word));
  return words.join(" ").trim();
}

function significantTerms(productQuery: string): string[] {
  return unique(
    productQuery
      .split(/\s+/)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

function listUpdateMode(message: string, hasValues: boolean, noun: string): "clear" | "replace" | "add" {
  const clear = new RegExp(`\\b(any ${noun}|no ${noun} preference)\\b`, "i");
  if (clear.test(message)) return "clear";
  if (hasValues && /\b(instead|only|just)\b/i.test(message)) return "replace";
  return "add";
}

function replacesProduct(message: string): boolean {
  return /\b(instead|actually|switch to|rather)\b/i.test(message);
}

function conditionMentioned(message: string): boolean {
  return /\bany condition\b/i.test(message) || extractCondition(message) != null;
}

function shipMentioned(message: string): boolean {
  return extractShipCountry(message) != null;
}

function normalizeToken(value: string): string {
  const token = value.trim().toLowerCase();
  return token === "grey" ? "gray" : token;
}

function stringList(value: unknown[]): string[] {
  return value.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 40));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    result.push(key);
  }
  return result;
}
