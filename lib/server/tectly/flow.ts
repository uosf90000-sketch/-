import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { readJson, writeJson } from "../json-store";
import { TectlyClient, TectlyError } from "./client";
import { normalizeTectlyResult, type ComparisonPlan } from "../../tectly/geometry";

export type TectlyState = {
  stage: "creating" | "uploading" | "processing" | "ready" | "partial" | "failed" | "uncertain";
  projectId: string; documentId?: string; sourceHash: string; updatedAt: string;
  pages?: { id: string; pageNumber: number; settled: boolean; failed?: boolean }[];
  plans: { id: string; pageNumber: number; settled: boolean; failed?: boolean }[];
  results: ComparisonPlan[]; error?: string; errorCode?: string;
};
const processingKeys = ["wallProcessingStatus", "roomProcessingStatus", "wallOpeningProcessingStatus", "horizontalScaleProcessingStatus", "postProcessingStatus"];
const statuses = ["Positive", "Negative", "Failed", "Pending"];
const supported = new Set(["png", "jpg", "jpeg", "webp", "pdf"]);
const hasId = (v: any): v is { id: string } => typeof v?.id === "string" && v.id.length > 0;
export async function runTectlyStep(dir: string, action: "start" | "poll", confirmed: boolean, client: TectlyClient) {
  const file = path.join(dir, "tectly-state.json");
  let state: TectlyState | null = await readJson(file);
  const save = async () => { state!.updatedAt = new Date().toISOString(); await writeJson(file, state); return state!; };
  const meta = await readJson(path.join(dir, "meta.json"));
  if (!meta) throw new TectlyError("missing_upload", "لم نعثر على المخطط.", 404);
  if (!supported.has(meta.extension)) throw new TectlyError("unsupported", "القراءة الإضافية متاحة لصور المخططات وPDF حاليًا.", 415);
  if (state && ["ready", "partial", "failed"].includes(state.stage)) return state;
  if (!state && action !== "start") throw new TectlyError("not_started", "ابدأ القراءة الإضافية أولًا.", 409);
  if (!state && !confirmed) throw new TectlyError("usage_confirmation", "تشغيل القراءة الإضافية يستهلك من رصيد حساب Tectly.", 409);
  if (!state) {
    // Authenticate before persisting a paid-upload intent. No analysis credit is spent here.
    await client.authenticate();
    const bytes = await readFile(path.join(dir, path.basename(meta.storedName)));
    state = { stage: "creating", projectId: randomUUID(), sourceHash: createHash("sha256").update(bytes).digest("hex"), updatedAt: "", plans: [], results: [] };
    await save();
    try {
      const project = await client.createProject(state.projectId, `Bayti ${meta.id || path.basename(dir)}`);
      if (!hasId(project)) throw new TectlyError("invalid_project", "لم يرجع معرّف المشروع. سنحاول استعادة حالة الطلب دون تكرار الرفع.");
      state.projectId = project.id; state.stage = "uploading"; await save();
      const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" } as Record<string, string>)[meta.extension];
      const document = await client.addDocument(state.projectId, bytes, meta.name, mime);
      if (!hasId(document)) throw new TectlyError("invalid_document", "استُقبل الملف دون معرّف واضح. سنحاول استعادته دون تكرار الرفع.");
      state.documentId = document.id; state.stage = "processing";
    } catch (error) {
      state.stage = "uncertain";
      state.error = error instanceof TectlyError ? error.message : "تعذر استكمال إرسال الملف. استكمل للتحقق من الطلب قبل أي إعادة إرسال.";
      state.errorCode = error instanceof TectlyError ? error.code : "save_failed";
    }
    return save();
  }
  // Restart/reload only follows saved remote identifiers; never resubmit a document.
  if (!state.documentId) {
    const project = await client.request(`/projects/${encodeURIComponent(state.projectId)}`);
    const documents = Array.isArray(project?.documents) ? project.documents.filter(hasId) : [];
    if (documents.length !== 1) {
      state.stage = "uncertain";
      state.error = "لم نستطع تأكيد وصول الملف. لم نكرر الإرسال حفاظًا على رصيدك. استكمل لاحقًا أو راجع الطلب في حساب Tectly.";
      return save();
    }
    state.documentId = documents[0].id; state.stage = "processing";
  }
  delete state.error; delete state.errorCode;
  if (!state.pages) {
    const document = await client.request(`/documents/${encodeURIComponent(state.documentId!)}`);
    if (!statuses.includes(document?.pageRenderingStatus)) throw new TectlyError("invalid_status", "وصلت حالة معالجة غير معروفة.");
    if (document.pageRenderingStatus === "Pending") return save();
    if (document.pageRenderingStatus !== "Positive" || !Array.isArray(document.documentPages) || !document.documentPages.length) {
      state.stage = "failed"; state.error = "لم يتمكن القارئ الإضافي من استخراج صفحات المخطط."; return save();
    }
    if (document.documentPages.length > 50 || !document.documentPages.every(hasId)) throw new TectlyError("invalid_pages", "هذا المستند يحتاج تقسيمه إلى ملفات أصغر للمقارنة.");
    state.pages = document.documentPages.map((page: any) => ({ id: page.id, pageNumber: page.pageNumber, settled: false }));
    await save();
  }
  const page = state.pages!.find(p => !p.settled);
  if (page) {
    const result = await client.request(`/document-pages/${encodeURIComponent(page.id)}`);
    if (!statuses.includes(result?.planDetectionStatus)) throw new TectlyError("invalid_status", "وصلت حالة صفحة غير معروفة.");
    if (result.planDetectionStatus === "Pending") return save();
    if (Array.isArray(result.plans)) for (const p of result.plans) if (hasId(p) && !state.plans.some(q => q.id === p.id)) state.plans.push({ id: p.id, pageNumber: page.pageNumber, settled: false });
    page.failed = result.planDetectionStatus !== "Positive";
    page.settled = true;
    return save();
  }
  const pending = state.plans.find(p => !p.settled);
  if (pending) {
    const plan = await client.request(`/plans/${encodeURIComponent(pending.id)}`);
    if (!processingKeys.every(key => statuses.includes(plan?.[key]))) throw new TectlyError("invalid_status", "وصلت حالة مخطط غير معروفة.");
    if (processingKeys.some(key => plan[key] === "Pending")) return save();
    if (!plan.floorId) { pending.settled = true; pending.failed = true; return save(); }
    const floorPath = `/floors/${encodeURIComponent(plan.floorId)}`;
    const [floor, walls, rooms, openings] = await Promise.all([client.request(floorPath), client.request(floorPath + "/walls"), client.request(floorPath + "/rooms"), client.request(floorPath + "/wall-openings")]);
    const normalized = normalizeTectlyResult(plan, pending.pageNumber, floor, walls, rooms, openings);
    state.results.push(normalized); pending.settled = true;
    await save();
  }
  if (state.plans.every(p => p.settled)) {
    state.stage = state.results.length ? (state.pages!.some(p => p.failed) || state.plans.some(p => p.failed) || state.results.some(p => p.warnings.length) ? "partial" : "ready") : "failed";
    if (state.pages!.some(p => p.failed) && state.results.length) state.error = "بعض الصفحات لم تُقرأ. المعروض هو النتائج التي وصلت فقط.";
    if (!state.results.length) state.error = "لم يُعثر على مخطط قابل للمقارنة في الملف.";
  }
  return save();
}

export function publicTectlyState(state: TectlyState | null) {
  if (!state) return null;
  return { stage: state.stage, updatedAt: state.updatedAt, pageCount: state.pages?.length || 0, planCount: state.plans.length, completedPlans: state.plans.filter(p => p.settled).length, results: state.results, error: state.error, errorCode: state.errorCode };
}
