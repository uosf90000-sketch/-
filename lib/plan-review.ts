export function spaceType(name: string, type = "") {
  const text = `${name} ${type}`.toLowerCase();
  if (/درج|سلم|stair/.test(text)) return "stairs";
  if (/مصعد|elevator|lift/.test(text)) return "elevator";
  if (/حوش|فناء|حديقة|patio|garden|courtyard/.test(text)) return "outdoor";
  if (/كراج|قراج|موقف|garage|parking/.test(text)) return "garage";
  return type || "unknown";
}
export type PlanReview = { openings: any[]; removed: string[]; roomNames: Record<string, string>; walls?: any[] };
export const emptyReview: PlanReview = { openings: [], removed: [], roomNames: {} };
export function openingKey(o: any) {
  return o.id || `${o.kind || "door"}:${o.wallEntityId}:${Number(o.position).toFixed(4)}`;
}
export function mergeOpenings(walls: any[], primary: any[], extra: any[] = [], removed: string[] = []) {
  const result: any[] = [];
  for (const raw of [...primary, ...extra]) {
    const o = { ...raw, kind: raw.kind || "door" };
    const wall = walls.find(w => Number(w.entityId) === Number(o.wallEntityId));
    if (!wall || removed.includes(openingKey(o))) continue;
    const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    if (!Number.isFinite(o.position) || !(length > 0)) continue;
    if (result.some(p => p.wallEntityId === o.wallEntityId &&
      Math.abs(p.position - o.position) * length < Math.max(.15, Math.min(p.widthM || .9, o.widthM || .9) * .5))) continue;
    result.push(o);
  }
  return result;
}
export function applyPlanReview(analysis: any, review: PlanReview = emptyReview, names?: any) {
  if (!analysis?.ifcPlan) return analysis;
  const walls = [...(analysis.ifcPlan.walls || []), ...(review.walls || [])];
  const a = names?.alignment;
  const xs = walls.flatMap((w: any) => [w.x1, w.x2]);
  const ys = walls.flatMap((w: any) => [w.y1, w.y2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const assigned = new Set<number>();
  return { ...analysis, reviewRemoved: review.removed,
    ifcPlan: { ...analysis.ifcPlan, walls, openings: mergeOpenings(walls, [...review.openings, ...(analysis.ifcPlan.openings || [])], [], review.removed) },
    inferredRooms: (analysis.inferredRooms || []).map((room: any) => {
      const providerSpaces = (analysis.ifcPlan.spaces || []).filter((space: any) => {
        let contained = false;
        const poly = space.polygon || [], p = room.center;
        if (!p) return false;
        for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
          const a=poly[i], b=poly[j];
          if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) contained=!contained;
        }
        return contained && space.name;
      });
      if (providerSpaces.length === 1) room = { ...room, name: providerSpaces[0].name, type: spaceType(providerSpaces[0].name), providerAreaM2: providerSpaces[0].areaM2 };
      const manual = review.roomNames[String(room.id)];
      if (manual) return { ...room, name: manual, type: spaceType(manual) };
      if (!a || !(maxX > minX && maxY > minY)) return room;
      const x = (a.left + (room.center.x - minX) / (maxX - minX) * a.width) * 1000;
      const y = (a.top + (1 - (room.center.y - minY) / (maxY - minY)) * a.height) * 1000;
      const candidates = (names.rooms || []).map((r: any, i: number) => ({ r, i }))
        .filter(({ r, i }: any) => !assigned.has(i) && r.confidence >= .65 && x >= r.bbox.x && x <= r.bbox.x + r.bbox.width && y >= r.bbox.y && y <= r.bbox.y + r.bbox.height)
        .sort((p: any, q: any) => p.r.bbox.width * p.r.bbox.height - q.r.bbox.width * q.r.bbox.height);
      if (!candidates.length) return room;
      assigned.add(candidates[0].i);
      return { ...room, name: candidates[0].r.name, type: spaceType(candidates[0].r.name, candidates[0].r.type) };
    }) };
}
export function editReview(review: PlanReview, action: any, analysis: any): PlanReview {
  if (action?.type === "room") {
    const name = typeof action.name === "string" ? action.name.trim() : "";
    if (!name || name.length > 80 || !(analysis.inferredRooms || []).some((r: any) => String(r.id) === action.roomId)) throw new Error("اختر غرفة واكتب اسمًا لا يتجاوز ٨٠ حرفًا.");
    return { ...review, roomNames: { ...review.roomNames, [action.roomId]: name } };
  }
  if (action?.type === "remove" && typeof action.key === "string" && action.key.length < 150) {
    const remaining = review.openings.filter(o => openingKey(o) !== action.key);
    return { ...review, walls: (review.walls || []).filter(w => remaining.some(o => o.wallEntityId === w.entityId)), openings: remaining, removed: [...new Set([...review.removed, action.key])] };
  }
  if (action?.type === "opening") {
    const o = action.opening;
    const existingWalls = [...(analysis.ifcPlan?.walls || []), ...(review.walls || [])];
    const host = o?.point && Number.isFinite(o.point.x) && Number.isFinite(o.point.y) ? openingHostAt(existingWalls, o.point.x, o.point.y) : null;
    const wall = existingWalls.find((w: any) => w.entityId === o?.wallEntityId) || (host && host.wall.entityId === o?.wallEntityId ? host.wall : null);
    const length = wall && Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    if (!wall || !["door", "window"].includes(o.kind) || !Number.isFinite(o.position) || o.position < 0 || o.position > 1 || !Number.isFinite(o.widthM) || o.widthM < .4 || o.widthM > 4 || o.widthM > length + .002 || o.position * length < o.widthM / 2 - .02 || (1 - o.position) * length < o.widthM / 2 - .02) throw new Error("الفتحة يجب أن تقع داخل الجدار. اختر منتصفها واضبط العرض.");
    const opening = { kind: o.kind, wallEntityId: o.wallEntityId, position: o.position, widthM: o.widthM, heightM: o.kind === "door" ? 2.1 : 1.2, sillM: o.kind === "door" ? 0 : .9, source: "user-confirmed", confidence: 1 };
    const addedWall = existingWalls.some((w: any) => w.entityId === wall.entityId) ? [] : [wall];
    return { ...review, walls: [...(review.walls || []), ...addedWall], openings: mergeOpenings([...existingWalls, ...addedWall], [opening, ...review.openings]), removed: review.removed.filter(k => k !== openingKey(opening)) };
  }
  throw new Error("التصحيح غير صالح.");
}

// A doorway may already be a gap between two IFC wall segments. Host it on
// that gap, rather than snapping it to (and cutting) the neighboring solid wall.
export function openingHostAt(walls: any[], x: number, y: number) {
  let best: { wall: any; position: number; distance: number } | null = null;
  const consider = (wall: any) => {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, length2 = dx * dx + dy * dy;
    if (!(length2 > 0)) return;
    const position = Math.max(0, Math.min(1, ((x - wall.x1) * dx + (y - wall.y1) * dy) / length2));
    const distance = Math.hypot(x - wall.x1 - position * dx, y - wall.y1 - position * dy);
    if (!best || distance < best.distance) best = { wall, position, distance };
  };
  walls.forEach(consider);
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i], b = walls[j];
    const al = Math.hypot(a.x2 - a.x1, a.y2 - a.y1), bl = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
    if (!al || !bl) continue;
    const ux = (a.x2 - a.x1) / al, uy = (a.y2 - a.y1) / al;
    if (Math.abs(ux * (b.x2 - b.x1) / bl + uy * (b.y2 - b.y1) / bl) < .995) continue;
    for (const ai of [1, 2]) for (const bi of [1, 2]) {
      const x1 = a[`x${ai}`], y1 = a[`y${ai}`], x2 = b[`x${bi}`], y2 = b[`y${bi}`];
      const gap = Math.hypot(x2 - x1, y2 - y1);
      if (gap < .4 || gap > 3 || Math.abs((x2 - x1) * uy - (y2 - y1) * ux) > .12) continue;
      const gx = (x2 - x1) / gap, gy = (y2 - y1) / gap;
      const crossesWall = walls.some(w => {
        const t1 = (w.x1 - x1) * gx + (w.y1 - y1) * gy, t2 = (w.x2 - x1) * gx + (w.y2 - y1) * gy;
        const n1 = Math.abs((w.x1 - x1) * gy - (w.y1 - y1) * gx), n2 = Math.abs((w.x2 - x1) * gy - (w.y2 - y1) * gx);
        return n1 < .15 && n2 < .15 && Math.min(gap, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)) > .12;
      });
      if (crossesWall) continue;
      const entityId = -1 - (((i * walls.length + j) * 4 + (ai - 1) * 2 + bi) * 1000);
      consider({ entityId, x1, y1, x2, y2, thickness: a.thickness || .18, heightM: a.heightM || 2.8, source: "user-confirmed-gap" });
    }
  }
  return best as { wall: any; position: number; distance: number } | null;
}
