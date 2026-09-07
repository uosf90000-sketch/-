// Viewer-only navigation. It never modifies the imported floor plan.
export type Point = { x: number; z: number };
export function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export function createNavigation(
  walls: any[],
  openings: any[],
  items: any[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
) {
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY),
    step = Math.max(0.25, span / 110),
    radius = 0.18;
  const segments: { a: Point; b: Point; thickness: number }[] = [];
  for (const w of walls) {
    const ax = Number(w.x1),
      az = -Number(w.y1),
      dx = Number(w.x2) - ax,
      dz = -Number(w.y2) - az,
      len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const intervals = openings
      .filter(
        (o) =>
          o.kind === "door" && Number(o.wallEntityId) === Number(w.entityId),
      )
      .map((o) => ({
        start: Math.max(
          0,
          Number(o.position) - (Number(o.widthM) || 0.9) / len / 2,
        ),
        end: Math.min(
          1,
          Number(o.position) + (Number(o.widthM) || 0.9) / len / 2,
        ),
      }))
      .sort((a, b) => a.start - b.start);
    let at = 0;
    for (const gap of [...intervals, { start: 1, end: 1 }]) {
      if (gap.start > at)
        segments.push({
          a: { x: ax + dx * at, z: az + dz * at },
          b: { x: ax + dx * gap.start, z: az + dz * gap.start },
          thickness: Number(w.thickness) || 0.18,
        });
      at = Math.max(at, gap.end);
    }
  }
  const obstacles = items
    .filter((i) => !/light|إنار|ac|تكييف|مكيف/.test(i.category || ""))
    .map((i) => ({
      x:
        bounds.minX +
        (Math.max(0, Math.min(1000, i.planX)) / 1000) *
          (bounds.maxX - bounds.minX),
      z: -(
        bounds.maxY -
        (Math.max(0, Math.min(1000, i.planY)) / 1000) *
          (bounds.maxY - bounds.minY)
      ),
      w: Math.max(0.25, Number(i.widthM) || 1),
      d: Math.max(0.25, Number(i.depthM) || 1),
      a: (-(Number(i.rotationDeg) || 0) * Math.PI) / 180,
    }));
  function clear(p: Point) {
    if (
      p.x < bounds.minX + radius ||
      p.x > bounds.maxX - radius ||
      p.z < -bounds.maxY + radius ||
      p.z > -bounds.minY - radius
    )
      return false;
    for (const s of segments)
      if (distanceToSegment(p, s.a, s.b) < radius + s.thickness / 2)
        return false;
    for (const o of obstacles) {
      const dx = p.x - o.x,
        dz = p.z - o.z;
      const x = dx * Math.cos(o.a) - dz * Math.sin(o.a),
        z = dx * Math.sin(o.a) + dz * Math.cos(o.a);
      if (Math.abs(x) < o.w / 2 + radius && Math.abs(z) < o.d / 2 + radius)
        return false;
    }
    return true;
  }
  function lineClear(a: Point, b: Point) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.08);
    for (let i = 1; i <= n; i++)
      if (
        !clear({
          x: a.x + ((b.x - a.x) * i) / n,
          z: a.z + ((b.z - a.z) * i) / n,
        })
      )
        return false;
    return true;
  }
  function nearest(p: Point, accept: (q: Point) => boolean = () => true) {
    if (clear(p) && accept(p)) return p;
    for (let ring = 1; ring < 80; ring++)
      for (let a = 0; a < 24; a++) {
        const q = {
          x: p.x + Math.cos((a * Math.PI) / 12) * ring * step,
          z: p.z + Math.sin((a * Math.PI) / 12) * ring * step,
        };
        if (clear(q) && accept(q)) return q;
      }
    return null;
  }
  const cols = Math.ceil((bounds.maxX - bounds.minX) / step) + 1,
    rows = Math.ceil((bounds.maxY - bounds.minY) / step) + 1;
  function atIndex(i: number): Point {
    return {
      x: bounds.minX + (i % cols) * step,
      z: -bounds.maxY + Math.floor(i / cols) * step,
    };
  }
  function index(p: Point) {
    return (
      Math.round((p.z + bounds.maxY) / step) * cols +
      Math.round((p.x - bounds.minX) / step)
    );
  }
  const passable = new Map<number, boolean>();
  function pass(i: number) {
    if (i < 0 || i >= cols * rows) return false;
    if (!passable.has(i)) passable.set(i, clear(atIndex(i)));
    return passable.get(i)!;
  }
  function gridNear(p: Point) {
    const center = index(p);
    let best = -1,
      bestDist = Infinity;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const i = center + dy * cols + dx;
        if (!pass(i)) continue;
        const q = atIndex(i),
          d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < bestDist && lineClear(p, q)) {
          best = i;
          bestDist = d;
        }
      }
    return best;
  }
  function route(from: Point, to: Point): Point[] {
    if (!clear(from) || !clear(to)) return [];
    if (lineClear(from, to)) return [to];
    const start = gridNear(from),
      end = gridNear(to);
    if (start < 0 || end < 0) return [];
    const queue = [start],
      parents = new Map<number, number>([[start, -1]]);
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      if (cur === end) break;
      for (const offset of [-1, 1, -cols, cols]) {
        const next = cur + offset;
        if (
          Math.abs((cur % cols) - (next % cols)) > 1 ||
          parents.has(next) ||
          !pass(next) ||
          !lineClear(atIndex(cur), atIndex(next))
        )
          continue;
        parents.set(next, cur);
        queue.push(next);
      }
    }
    if (!parents.has(end)) return [];
    const raw: Point[] = [to];
    let cursor = end;
    while (cursor !== start && cursor !== -1) {
      raw.push(atIndex(cursor));
      cursor = parents.get(cursor) ?? -1;
    }
    raw.push(atIndex(start));
    raw.reverse();
    const smooth: Point[] = [];
    let anchor = from;
    for (let i = 0; i < raw.length; ) {
      let next = i;
      while (next + 1 < raw.length && lineClear(anchor, raw[next + 1])) next++;
      smooth.push(raw[next]);
      anchor = raw[next];
      i = next + 1;
    }
    return smooth;
  }
  return { clear, lineClear, nearest, route };
}
