export type Point = [number, number];
export type Section = { left: number; top: number; width: number; height: number };
export type ComparisonPlan = {
  id: string; pageNumber: number; section: Section;
  walls: { id: string; boundary: Point[] }[];
  rooms: { id: string; boundary: Point[]; caption: string; type: string }[];
  openings: { id: string; kind: "door" | "window"; from: Point; to: Point; swing?: Point }[];
  horizontalScale: number | null; verticalScale: number | null; warnings: string[];
};
const point = (value: any): value is Point => Array.isArray(value) && value.length >= 2 && value.slice(0, 2).every((n: any) => typeof n === "number" && Number.isFinite(n) && n >= -.1 && n <= 1.1);
const copyPoint = (p: Point): Point => [p[0], p[1]];
const polygon = (v: any): v is Point[] => Array.isArray(v) && v.length >= 3 && v.length <= 2000 && v.every(point);
export function validSection(a: any): a is Section {
  return a && [a.left, a.top, a.width, a.height].every(Number.isFinite) && a.left >= 0 && a.top >= 0 && a.width > 0 && a.height > 0 && a.left + a.width <= 1.001 && a.top + a.height <= 1.001;
}
export function normalizeTectlyResult(plan: any, pageNumber: number, floor: any, walls: any, rooms: any, openings: any): ComparisonPlan {
  if (typeof plan?.id !== "string" || !plan.id || !Number.isInteger(pageNumber) || pageNumber < 0 || !validSection(plan?.pageSection) || ![walls, rooms, openings].every(Array.isArray)) throw new Error("تعذر تفسير مواضع نتيجة القارئ الإضافي.");
  const result: ComparisonPlan = { id: plan.id, pageNumber, section: { left: plan.pageSection.left, top: plan.pageSection.top, width: plan.pageSection.width, height: plan.pageSection.height }, walls: [], rooms: [], openings: [], horizontalScale: Number.isFinite(floor?.horizontalScale) && floor.horizontalScale > 0 ? floor.horizontalScale : null, verticalScale: Number.isFinite(floor?.verticalScale) && floor.verticalScale > 0 ? floor.verticalScale : null, warnings: [] };
  for (const wall of walls) if (typeof wall.id === "string" && polygon(wall.boundary)) result.walls.push({ id: wall.id, boundary: wall.boundary.map((p: Point) => [p[0], p[1]]) });
  for (const room of rooms) if (typeof room.id === "string" && polygon(room.boundary)) result.rooms.push({ id: room.id, boundary: room.boundary.map((p: Point) => [p[0], p[1]]), caption: typeof room.caption === "string" ? room.caption.slice(0, 100) : "", type: typeof room.type === "string" ? room.type.slice(0, 80) : "Other" });
  for (const opening of openings) {
    const d = opening.details;
    if (typeof opening.id !== "string" || !d) continue;
    if (point(d.hinge) && point(d.closed) && point(d.open)) result.openings.push({ id: opening.id, kind: "door", from: copyPoint(d.hinge), to: copyPoint(d.closed), swing: copyPoint(d.open) });
    else if (point(d.from) && point(d.to)) result.openings.push({ id: opening.id, kind: "window", from: copyPoint(d.from), to: copyPoint(d.to) });
    else if (point(d.closed) && point(d.open)) result.openings.push({ id: opening.id, kind: "door", from: copyPoint(d.closed), to: copyPoint(d.open) });
  }
  if (result.walls.length !== walls.length || result.rooms.length !== rooms.length || result.openings.length !== openings.length) result.warnings.push("بعض العناصر وصلت بمواضع غير صالحة ولم تُعرض.");
  if (!result.horizontalScale || !result.verticalScale) result.warnings.push("لم يكتمل تحديد المقياس لدى القارئ الإضافي؛ المقارنة هنا على الصورة.");
  for (const key of ["wallProcessingStatus", "roomProcessingStatus", "wallOpeningProcessingStatus"]) if (plan[key] !== "Positive") result.warnings.push("لم تكتمل قراءة بعض أنواع العناصر. راجع النتيجة على الصورة.");
  result.warnings = [...new Set(result.warnings)];
  return result;
}
export function imagePoint(p: Point, section: Section): Point { return [section.left + p[0] * section.width, section.top + p[1] * section.height]; }
export function worldPoint(p: Point, section: Section, alignment: Section, walls: any[]): { x: number; y: number } {
  if (!validSection(alignment) || !walls.length) throw new Error("طابق الجدران مع الصورة أولًا.");
  const xs = walls.flatMap(w => [w.x1, w.x2]), ys = walls.flatMap(w => [w.y1, w.y2]);
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  if (!(maxX > minX && maxY > minY)) throw new Error("لا توجد أبعاد صالحة للمخطط الأساسي.");
  const [u, v] = imagePoint(p, section);
  return { x: minX + (u - alignment.left) / alignment.width * (maxX - minX), y: maxY - (v - alignment.top) / alignment.height * (maxY - minY) };
}
export const roomLabel = (room: { caption: string; type: string }) => room.caption || ({ Stairs: "درج", Staircase: "درج", Elevator: "مصعد", LivingRoom: "صالة", Bedroom: "غرفة نوم", Bathroom: "حمام", Corridor: "ممر", Kitchen: "مطبخ", DiningRoom: "غرفة طعام", Office: "مكتب", Storage: "مستودع", Garage: "موقف سيارة", Patio: "فناء", Balcony: "شرفة" } as Record<string, string>)[room.type] || "مساحة";
