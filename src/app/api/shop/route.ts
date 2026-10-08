import { shoppingClientKey } from "@/lib/gemini-budget";
import { sameOriginRequest } from "@/lib/request-origin";
import { createShopBudget } from "@/lib/shop-budget";
import {
  SessionConflictError,
  SessionExpiredError,
  SessionStorageError,
  isShoppingSessionId,
} from "@/lib/session-snapshot";
import { SHOPPING_MESSAGE_LIMIT, getShoppingService } from "@/lib/shopping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const shopBudget = createShopBudget();

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "Start a shopping search." }, { status: 400 });
  if (!isShoppingSessionId(sessionId)) {
    return Response.json({ error: "This shopping session expired. Start a new search." }, { status: 404 });
  }
  try {
    const service = getShoppingService();
    await service.hydrate(sessionId, { force: true });
    return Response.json(service.getSession(sessionId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SessionStorageError) {
      return Response.json({ error: "Shopping session storage is temporarily unavailable." }, { status: 503 });
    }
    if (error instanceof SessionExpiredError) {
      return Response.json({ error: "This shopping session expired. Start a new search." }, { status: 410 });
    }
    return Response.json({ error: "This shopping session expired. Start a new search." }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOriginRequest(request)) {
    return Response.json({ error: "Open SuperTab from its own site to change a shopping session." }, { status: 403 });
  }
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !isShoppingSessionId(sessionId)) {
    return Response.json({ error: "This shopping session expired. Start a new search." }, { status: 404 });
  }
  try {
    await getShoppingService().forget(sessionId);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SessionStorageError) {
      return Response.json({ error: "Shopping session storage is temporarily unavailable." }, { status: 503 });
    }
    return Response.json({ error: "This shopping session could not be cleared." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) {
    return Response.json({ error: "Open SuperTab from its own site to search." }, { status: 403 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 8_000) {
      return Response.json({ error: "Keep the shopping request under 500 characters." }, { status: 400 });
    }
    const body = JSON.parse(raw) as { sessionId?: unknown; message?: unknown; turnId?: unknown };
    const message = typeof body.message === "string" ? body.message : "";
    if (message.trim().length > SHOPPING_MESSAGE_LIMIT) {
      return Response.json({ error: "Keep the shopping request under 500 characters." }, { status: 400 });
    }
    if (typeof body.sessionId === "string" && body.sessionId && !isShoppingSessionId(body.sessionId)) {
      return Response.json({ error: "This shopping session expired. Start a new search." }, { status: 404 });
    }
    const clientKey = shoppingClientKey(request);
    if (!(await shopBudget.reserve(clientKey))) {
      return Response.json({ error: "Too many shopping searches. Wait a few minutes and try again." }, { status: 429 });
    }
    const turnId = typeof body.turnId === "string" && body.turnId.length > 0 && body.turnId.length <= 80
      ? body.turnId : undefined;
    const view = await getShoppingService().converse(
      typeof body.sessionId === "string" ? body.sessionId : null,
      message,
      { clientKey, turnId },
    );
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SessionStorageError) {
      return Response.json({ error: "Shopping session storage is temporarily unavailable. Your draft is still here." }, { status: 503 });
    }
    if (error instanceof SessionConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SessionExpiredError) {
      return Response.json({ error: error.message }, { status: 410 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "The shopping request could not be read." }, { status: 400 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Search failed." }, { status: 400 });
  }
}
