import { getTectlyClient, tectlyConfig, TectlyError } from "@/lib/server/tectly/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const config = tectlyConfig();
  try {
    await getTectlyClient().authenticate();
    return Response.json({ ok: true, configured: true, authenticated: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, configured: config.configured, authenticated: false, code: error instanceof TectlyError ? error.code : "connection", error: error instanceof TectlyError ? error.message : "تعذر اختبار الاتصال." }, { status: error instanceof TectlyError ? error.status : 502, headers: { "cache-control": "no-store" } });
  }
}
