import { readFile, writeFile, rename } from "node:fs/promises";
import { withFileLock } from "@/lib/server/json-store";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { editReview, emptyReview } from "@/lib/plan-review";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROOT = process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";
const validId = (id: string) => /^[a-f0-9-]{36}$/i.test(id);
async function readReview(dir: string) {
  return JSON.parse(await readFile(path.join(dir, "review.json"), "utf8").catch((e) => { if (e.code === "ENOENT") return JSON.stringify(emptyReview); throw e; }));
}
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return Response.json({ ok: false }, { status: 400 });
  try { return Response.json({ ok: true, review: await readReview(path.join(ROOT, "uploads", id)) }); }
  catch { return Response.json({ ok: false, error: "تعذر قراءة التصحيحات المحفوظة." }, { status: 500 }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return Response.json({ ok: false }, { status: 400 });
  const dir = path.join(ROOT, "uploads", id);
  try {
    return await withFileLock(path.join(dir, "review.json"), async () => {
    const analysis = JSON.parse(await readFile(path.join(dir, "analysis.json"), "utf8"));
    const review = editReview(await readReview(dir), await request.json(), analysis);
    const temporary = path.join(dir, `review-${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(review), "utf8");
    await rename(temporary, path.join(dir, "review.json"));
    return Response.json({ ok: true, review });
    });
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error && !/ENOENT|EACCES/.test(error.message) ? error.message : "تعذر حفظ التصحيح. حاول مرة أخرى." }, { status: 400 }); }
}
