import { applyPlanReview, editReview, mergeOpenings, openingHostAt, type PlanReview } from '../plan-review';
import { openingProposal, adoptTectlyElement } from './adopt';
import { roomLabel, validSection, type ComparisonPlan, type Section } from './geometry';

// Fuse saved observations only. Existing geometry and user corrections win conflicts.
export function fuseTectlyPlan(plan: ComparisonPlan, alignment: Section, analysis: any, review: PlanReview, rasterDoors: any[] = []) {
  if (!validSection(alignment) || !analysis?.ifcPlan?.walls?.length) throw new Error('أكمل القراءة الحالية وطابقها مع الصورة أولًا.');
  let updated = review;
  const report = { added: 0, matched: 0, named: 0, review: [] as { id: string; reason: string }[] };
  for (const item of plan.openings) {
    try {
      const proposal = openingProposal(plan, item.id, alignment, analysis, updated);
      const effective = applyPlanReview(analysis, updated);
      const walls = effective.ifcPlan.walls;
      const host = openingHostAt(walls, proposal.point.x, proposal.point.y)!.wall;
      const length = Math.hypot(host.x2-host.x1, host.y2-host.y1);
      const ux = (host.x2-host.x1)/length, uy = (host.y2-host.y1)/length;
      const candidates = mergeOpenings(walls, effective.ifcPlan.openings, rasterDoors, updated.removed);
      // Compare physical intervals, including openings on separate collinear wall segments.
      const overlaps = candidates.filter(o => {
        const w = walls.find((w: any) => w.entityId === o.wallEntityId);
        if (!w) return false;
        const l = Math.hypot(w.x2-w.x1,w.y2-w.y1);
        if (!l || Math.abs(((w.x2-w.x1)*ux+(w.y2-w.y1)*uy)/l) < .98) return false;
        const dx = w.x1+(w.x2-w.x1)*o.position-proposal.point.x;
        const dy = w.y1+(w.y2-w.y1)*o.position-proposal.point.y;
        return Math.abs(dx*uy-dy*ux) < .2 && Math.abs(dx*ux+dy*uy) < (o.widthM+proposal.widthM)/2-.05;
      });
      if (overlaps.length) {
        if (overlaps.length === 1 && overlaps[0].kind === proposal.kind && Math.abs(overlaps[0].widthM-proposal.widthM) <= .2) report.matched++;
        else report.review.push({ id: item.id, reason: 'اختلاف في النوع أو العرض؛ احتفظنا بالفتحة الحالية. راجعها، خصوصًا الباب ذا الضلفتين.' });
        continue;
      }
      const next = editReview(updated, { type: 'opening', opening: proposal }, analysis);
      // A removed observation must not be silently reintroduced by another reader.
      if (updated.removed.length !== next.removed.length) {
        report.review.push({ id: item.id, reason: 'سبق حذف فتحة في هذا الموضع؛ لم نعد إضافتها.' });
        continue;
      }
      updated = next;
      report.added++;
    } catch (e) {
      report.review.push({ id: item.id, reason: e instanceof Error ? e.message : 'موضع الفتحة يحتاج مراجعة.' });
    }
  }
  for (const room of plan.rooms) {
    if (!room.caption.trim() && roomLabel(room) === "مساحة") continue;
    try {
      const next = adoptTectlyElement(plan, { kind: 'room', id: room.id }, alignment, analysis, updated);
      const entries = Object.entries(next.roomNames).filter(([id, name]) => !updated.roomNames[id] && name);
      if (entries.length) { updated = { ...updated, roomNames: { ...updated.roomNames, ...Object.fromEntries(entries) } }; report.named += entries.length; }
    } catch { report.review.push({ id: room.id, reason: 'اسم الغرفة يحتاج مطابقة يدوية.' }); }
  }
  return { review: updated, report };
}
