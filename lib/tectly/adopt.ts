import { editReview, openingHostAt, type PlanReview } from "../plan-review";
import { worldPoint, roomLabel, type ComparisonPlan, type Section } from "./geometry";

export function openingProposal(plan: ComparisonPlan, openingId: string, alignment: Section, analysis: any, review: PlanReview) {
  const o = plan.openings.find(p => p.id === openingId);
  if (!o) throw new Error("لم نعثر على الفتحة المحددة في القراءة الإضافية.");
  const walls = analysis?.ifcPlan?.walls || [];
  const from = worldPoint(o.from, plan.section, alignment, walls), to = worldPoint(o.to, plan.section, alignment, walls);
  const widthM = Math.hypot(to.x - from.x, to.y - from.y);
  const point = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const host = openingHostAt([...walls, ...(review.walls || [])], point.x, point.y);
  if (!host) throw new Error("هذه الفتحة تحتاج تحديد الجدار يدويًا على المخطط.");
  const w = host.wall, length = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  const ux = (w.x2 - w.x1) / length, uy = (w.y2 - w.y1) / length;
  const offAxis = (p: { x: number; y: number }) => Math.abs((p.x - w.x1) * uy - (p.y - w.y1) * ux);
  const parallel = Math.abs(((to.x - from.x) * ux + (to.y - from.y) * uy) / widthM);
  if (!Number.isFinite(widthM) || widthM < .4 || widthM > 4 || parallel < .98 || Math.max(offAxis(from), offAxis(to)) > Math.min(.3, Math.max(.12, (w.thickness || .18) * .8))) throw new Error("موضع الفتحة لا يتطابق بوضوح مع الجدار. صححها يدويًا بدل نقلها إلى جدار آخر.");
  return { kind: o.kind, wallEntityId: w.entityId, position: host.position, widthM, point };
}
function inside(p: { x: number; y: number }, polygon: any[]) {
  let contained = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) contained = !contained;
  }
  return contained;
}
export function adoptTectlyElement(plan: ComparisonPlan, element: { kind: "opening" | "room"; id: string }, alignment: Section, analysis: any, review: PlanReview) {
  if (element.kind === "opening") {
    const opening = openingProposal(plan, element.id, alignment, analysis, review);
    return editReview(review, { type: "opening", opening }, analysis);
  }
  const room = plan.rooms.find(r => r.id === element.id);
  if (!room || roomLabel(room) === "مساحة") throw new Error("هذه المساحة لا تحمل اسمًا واضحًا. سمّها بالضغط عليها في المخطط.");
  const polygon = room.boundary.map(p => worldPoint(p, plan.section, alignment, analysis.ifcPlan.walls));
  const matches = (analysis.inferredRooms || []).filter((r: any) => r.center && inside(r.center, polygon));
  if (matches.length !== 1) throw new Error("تقسيم هذه الغرفة مختلف بين القراءتين. حدّد اسمها يدويًا على المخطط الحالي.");
  return editReview(review, { type: "room", roomId: String(matches[0].id), name: roomLabel(room) }, analysis);
}
