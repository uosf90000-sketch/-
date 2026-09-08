import path from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getTectlyClient, TectlyError } from "@/lib/server/tectly/client";
import { runTectlyStep, publicTectlyState, type TectlyState } from "@/lib/server/tectly/flow";
import { readJson, writeJson, withFileLock } from "@/lib/server/json-store";
import { adoptTectlyElement } from "@/lib/tectly/adopt";
import { fuseTectlyPlan } from "@/lib/tectly/fuse";
import { emptyReview } from "@/lib/plan-review";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const root = () => process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";
const validId = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return Response.json({ ok: false }, { status: 400 });
  try { return Response.json({ ok: true, state: publicTectlyState(await readJson(path.join(root(), "uploads", id, "tectly-state.json"))) }, { headers: { "cache-control": "no-store" } }); }
  catch { return Response.json({ ok: false, error: "تعذر استعادة القراءة الإضافية." }, { status: 500 }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return Response.json({ ok: false }, { status: 400 });
  const dir = path.join(root(), "uploads", id);
  try {
    const input = await request.json();
    if (!["start", "poll", "adopt", "fuse"].includes(input.action)) return Response.json({ ok: false, error: "طلب غير صالح." }, { status: 400 });
    if (!await readJson(path.join(dir, "meta.json"))) return Response.json({ ok: false, error: "لم نعثر على المخطط." }, { status: 404 });
    return await withFileLock(path.join(dir, "tectly-state.json"), async () => {
      if (input.action === "adopt" || input.action === "fuse") {
        if (input.alignmentConfirmed !== true) return Response.json({ ok: false, error: "تأكد أولًا من تطابق الجدران الحالية مع صورة المخطط." }, { status: 409 });
        const state: TectlyState | null = await readJson(path.join(dir, "tectly-state.json"));
        const plan = state?.results.find(p => p.id === input.planId);
        if (!plan) return Response.json({ ok: false, error: "لم نعثر على النتيجة المحددة." }, { status: 404 });
        const meta = await readJson(path.join(dir, "meta.json"));
        if (!["png", "jpg", "jpeg", "webp"].includes(meta.extension)) return Response.json({ ok: false, error: "نقل العناصر إلى المخطط الحالي متاح للصور حاليًا. يمكن مقارنة صفحات PDF بصريًا." }, { status: 409 });
        const hash = createHash("sha256").update(await readFile(path.join(dir, path.basename(meta.storedName)))).digest("hex");
        if (hash !== state!.sourceHash) return Response.json({ ok: false, error: "تغيّر الملف الأصلي؛ لا يمكن اعتماد مواضع من قراءة سابقة." }, { status: 409 });
        return withFileLock(path.join(dir, "review.json"), async () => {
          const analysis = await readJson(path.join(dir, "analysis.json"));
          const review = await readJson(path.join(dir, "review.json"), emptyReview);
          if (input.action === "fuse") {
            const doors = await readJson(path.join(dir, "doors.json"));
            const result = fuseTectlyPlan(plan, input.alignment, analysis, review, doors?.doors || []);
            await writeJson(path.join(dir, "review.json"), result.review);
            return Response.json({ ok: true, ...result });
          }
          const updated = adoptTectlyElement(plan, input.element, input.alignment, analysis, review);
          await writeJson(path.join(dir, "review.json"), updated);
          return Response.json({ ok: true, review: updated });
        });
      }
      const state = await runTectlyStep(dir, input.action, input.confirmUsage === true, getTectlyClient());
      return Response.json({ ok: true, state: publicTectlyState(state) });
    });
  } catch (error) {
    const safe = error instanceof TectlyError || (error instanceof Error && /^[\u0600-\u06ff]/.test(error.message));
    return Response.json({ ok: false, code: error instanceof TectlyError ? error.code : "comparison_error", error: safe ? (error as Error).message : "تعذر إكمال القراءة الإضافية. يمكنك استكمالها دون إعادة رفع الملف." }, { status: error instanceof TectlyError ? error.status : 409 });
  }
}
