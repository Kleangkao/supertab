import { createHmac, timingSafeEqual } from "node:crypto";
import type { OrderState, PaymentState } from "./payment-lifecycle";

export interface CardEventEffect {
  payment: PaymentState;
  order: OrderState;
  providerReference: string | null;
}

const NO_ORDER: OrderState = "ORDER_NOT_CREATED";

export function mapBridgeCardEvent(event: unknown): CardEventEffect {
  const record = asRecord(event);
  const type = typeof record?.type === "string" ? record.type : "";
  const object = eventObject(record);
  const objectType = typeof object?.object === "string" ? object.object : "";
  const reference = stringField(object, "id");
  if (type.startsWith("issuing_authorization") || objectType === "issuing.authorization") {
    return { payment: authorizationState(object), order: NO_ORDER, providerReference: reference };
  }
  if (type.startsWith("issuing_transaction") || objectType === "issuing.transaction") {
    return { payment: transactionState(object), order: NO_ORDER, providerReference: reference };
  }
  throw new Error("This event is not a Bridge card authorization, capture, or refund.");
}

export function verifyIssuingWebhook(input: {
  payload: string;
  signatureHeader: string | null;
  secret: string | null;
  nowSec?: number;
}): boolean {
  if (!input.secret || !input.signatureHeader) return false;
  const parts = new Map(input.signatureHeader.split(",").map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index), part.slice(index + 1)] as const;
  }));
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", input.secret).update(`${timestamp}.${input.payload}`).digest("hex");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function authorizationState(object: Record<string, unknown> | null): PaymentState {
  const status = stringField(object, "status");
  if (status === "reversed") return "PAYMENT_REVERSED";
  if (object?.approved === true) return "PAYMENT_AUTHORIZED";
  if (status === "closed" || status === "declined") return "PAYMENT_FAILED";
  return "PAYMENT_PENDING";
}

function transactionState(object: Record<string, unknown> | null): PaymentState {
  const type = stringField(object, "type");
  if (type === "refund") return "PAYMENT_REFUNDED";
  if (type === "capture") return "PAYMENT_CAPTURED";
  throw new Error("This card transaction is neither a capture nor a refund.");
}

function eventObject(record: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!record) return null;
  if (typeof record.object === "string" && record.object.startsWith("issuing.")) return record;
  const data = asRecord(record.data);
  return asRecord(data?.object);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function stringField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
