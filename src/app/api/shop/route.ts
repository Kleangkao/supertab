import { getShoppingService } from "@/lib/shopping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sessionId?: unknown; message?: unknown };
    const view = await getShoppingService().converse(
      typeof body.sessionId === "string" ? body.sessionId : null,
      typeof body.message === "string" ? body.message : "",
    );
    return Response.json(view);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Search failed." }, { status: 400 });
  }
}
