// ============================================================
// مضلّع الغرفة من شبكة الجدران — لا من صورةٍ مُنقَّطة
// ============================================================
// المضلّعات تُستخرج الآن بملء الراستر: تُرسَم الجدران قناعًا، ويُملأ ما
// بينها، ويُتبَّع حدُّ المنطقة. وهذا يعمل، وثمنُه **مقيس**:
//
//   • **خطأ مساحةٍ ١٠٪** على مخطط العيّنة: ١٢.١٧ م² لغرفةٍ حقيقتها
//     ١٣.٥. والمساحة يُشترى بها بلاطٌ ودهان.
//   • **زوايا قائمة فقط**: التتبّع يمشي على حدود الخلايا، فالجدار
//     المائل يصير سلّمًا مُدرَّجًا.
//   • **الشبكة تُكمّم**: خطوةٌ من عدّة بكسلات تُزيح كل حدّ.
//   • **إغلاقٌ مورفولوجي لازم**: الباب فجوةٌ في القناع فيتسرّب منها
//     الملء، فتُغلَق الفجوات حتى متر — فيندمج فراغان بفتحةٍ أوسع.
//
// والجدران **مقروءةٌ بإحداثياتها** في DXF وIFC. فبناء شبكةٍ مستوية
// منها واستخراج وجوهها يعطي المضلّع **بالحساب لا بالتقريب**: بأي
// زاوية، وبلا تكميم، وبلا إغلاق — الباب سمةٌ على الجدار لا ثقبٌ فيه،
// فالجدار متّصلٌ في الشبكة والوجه يُغلَق من نفسه.

/** نقطة بوحدة النموذج (متر أو مليمتر — الوحدة للمُستدعي) */
export interface Point {
  x: number;
  y: number;
}

export interface GraphWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** سماكة الجدار — `null` إن لم تُعلَن، فلا يُزاح حدُّه */
  thickness: number | null;
}

/** قطعةُ جدارٍ بعد التقسيم عند التقاطعات */
export interface GraphEdge {
  /** الجدار الأصل — يُحفَظ فيُعرَف أيّ جدران تحدّ الغرفة */
  wallId: string;
  from: number;
  to: number;
  thickness: number | null;
}

export interface WallGraph {
  nodes: Point[];
  edges: GraphEdge[];
}

/**
 * تفاوت لحم الأطراف، نسبةً إلى سماكة الجدار.
 *
 * أطراف الجدران لا تلتقي تمامًا في الملفات: المُصدِّر يقطع الجدار عند
 * وجه مجاوره لا عند خطّه الأوسط، فيبقى نصفُ سماكةٍ فجوةً. وفجوةٌ واحدة
 * تُفشل إغلاق الوجه فتضيع الغرفة كلّها — فالتفاوت يجب أن يبلغ سماكةً
 * كاملة، ولا يزيد كثيرًا وإلّا لُحِم جداران متوازيان قريبان.
 */
export const SNAP_TOLERANCE_THICKNESSES = 1;

/** تفاوتٌ أدنى بوحدة النموذج حين تكون السماكات مجهولة */
export const MIN_SNAP_TOLERANCE = 1e-9;

// ============================================================
// وصل الجدران المقطوعة عند الفتحات — قبل بناء الشبكة
// ============================================================
// الجدار في الملف **ليس قطعةً متّصلة**: المُصدِّر يقطع وجهَيه عند كل باب
// ونافذة، فجدارٌ واحدٌ فيه بابان يخرج ثلاث قطع. وهذا قِيس على ملف
// العميل: أقرب طرفٍ لكل طرف وسيطه ١٣ سم، لكن **مئينه التسعين متر
// وسبعة سنتيمترات وأقصاه ٢.٩٦ م** — وهي عروض الأبواب والنوافذ.
//
// وبلا وصلٍ لا حلقةَ في الشبكة أصلًا: قِيس على الملف نفسه **صفر حلقات
// عند كل تفاوت**، فصفر غرف. وزيادة التفاوت لا تُصلحها — تلحم أطرافًا
// بعيدة فتُتلف الهندسة ولا تُغلق حلقة.
//
// والوصل هنا **لا يُخفي الفتحة**: الفتحات تُستخرج مستقلّةً من الأقواس
// وطبقة الزجاج قبل هذا، فالجدار الموصول يحمل فتحاته سمةً عليه.

/**
 * أوسع فجوةٍ تُوصَل — أوسع فتحةٍ معقولة في جدار.
 *
 * وهي العتبة المستعملة أصلًا في كشف الفتحات، فلا يُخترَع رقمٌ ثانٍ
 * للشيء نفسه. وفوقها يكون الفراغ ممرًّا أو فتحةً بلا جدار، ووصلُه
 * يُخترع جدارًا لا وجود له.
 */
export const MAX_BRIDGE_GAP_M = 2.5;

/** أقصى فرق زاويةٍ ليُعَدّ الجداران على استقامةٍ واحدة، بالدرجات */
export const COLLINEAR_ANGLE_DEG = 2;

interface LineKey {
  /** زاوية الخطّ في [0, π) — الاتجاه والمعاكس خطٌّ واحد */
  angle: number;
  /** بُعد الخطّ عن الأصل بالإشارة */
  offset: number;
}

function lineOf(wall: GraphWall): LineKey {
  let angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
  // التوحيد إلى نصف الدائرة: القطعة واتجاهها المعاكس خطٌّ واحد
  if (angle < 0) angle += Math.PI;
  if (angle >= Math.PI) angle -= Math.PI;

  const offset = -Math.sin(angle) * wall.x1 + Math.cos(angle) * wall.y1;
  return { angle, offset };
}

/**
 * وصل القطع المستقيمة المقطوعة عند الفتحات.
 *
 * `maxGap` بوحدة النموذج. والتجميع بالخطّ اللانهائي لا بالتجاور: قطعتان
 * على استقامةٍ واحدة بينهما بابٌ جدارٌ واحد، وقطعتان متوازيتان قريبتان
 * جدارَان — والفرق بُعدُ الخطّين.
 */
export function bridgeCollinearWalls(
  walls: readonly GraphWall[],
  tolerance: number,
  maxGap: number
): { walls: GraphWall[]; bridged: number } {
  const angleTolerance = (COLLINEAR_ANGLE_DEG * Math.PI) / 180;

  // تجميع على الخطوط
  const groups: { key: LineKey; members: GraphWall[] }[] = [];

  for (const wall of walls) {
    const key = lineOf(wall);
    const group = groups.find((candidate) => {
      const angleGap = Math.abs(candidate.key.angle - key.angle);
      // الفرق قرب π يعني الزاويةَ نفسها من الجهة الأخرى
      const wrapped = Math.min(angleGap, Math.PI - angleGap);
      return wrapped <= angleTolerance && Math.abs(candidate.key.offset - key.offset) <= tolerance;
    });

    if (group) group.members.push(wall);
    else groups.push({ key, members: [wall] });
  }

  const out: GraphWall[] = [];
  let bridged = 0;

  for (const group of groups) {
    const { angle } = group.key;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);

    // الإحداثي على طول الخطّ
    const spans = group.members
      .map((wall) => {
        const s1 = ux * wall.x1 + uy * wall.y1;
        const s2 = ux * wall.x2 + uy * wall.y2;
        return {
          wall,
          from: Math.min(s1, s2),
          to: Math.max(s1, s2),
        };
      })
      .sort((a, b) => a.from - b.from);

    const merged: { from: number; to: number; ids: string[]; thickness: number | null }[] = [
      {
        from: spans[0].from,
        to: spans[0].to,
        ids: [spans[0].wall.id],
        thickness: spans[0].wall.thickness,
      },
    ];

    for (let i = 1; i < spans.length; i += 1) {
      const span = spans[i];
      const last = merged[merged.length - 1];
      const gap = span.from - last.to;

      if (gap <= maxGap) {
        if (span.to > last.to) last.to = span.to;
        last.ids.push(span.wall.id);
        // السماكة الأكبر: القطعة الرقيقة قد تكون وجهًا قُرئ ناقصًا،
        // والأكبر أقرب إلى الجدار الحقيقي
        const thickest = Math.max(last.thickness ?? 0, span.wall.thickness ?? 0);
        last.thickness = thickest > 0 ? thickest : null;
        if (gap > tolerance) bridged += 1;
      } else {
        merged.push({
          from: span.from,
          to: span.to,
          ids: [span.wall.id],
          thickness: span.wall.thickness,
        });
      }
    }

    // الرجوع من إحداثيّ الخطّ إلى المستوى: نقطةٌ على الخطّ + الإزاحة
    // العمودية
    const baseX = -Math.sin(angle) * group.key.offset;
    const baseY = Math.cos(angle) * group.key.offset;

    for (const piece of merged) {
      out.push({
        id: piece.ids.length === 1 ? piece.ids[0] : piece.ids.join("+"),
        x1: baseX + ux * piece.from,
        y1: baseY + uy * piece.from,
        x2: baseX + ux * piece.to,
        y2: baseY + uy * piece.to,
        thickness: piece.thickness,
      });
    }
  }

  return { walls: out, bridged };
}

/** حاصل الضرب الاتجاهي — إشارتُه جهةُ الدوران */
function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * أقصى مدٍّ لطرفٍ حرّ — بوحدة النموذج (متر).
 *
 * القاطع الذي ينتهي دون الجدار المقابل بمسافةٍ صغيرة **بابٌ بلا درفة
 * مرسومة** لا فراغ: المُصدِّر يقطع الجدار عند الفتحة، ومن لم يرسم قوس
 * الفتح يترك فجوةً لا يسدّها شيء. فتُمَدّ نهايةُ الجدار على استقامته
 * حتى تبلغ ما تكاد تلمسه.
 *
 * والحدُّ متر: هو نفسه حدُّ الإغلاق في مسار الراستر، فلا يُخترَع رقمٌ
 * ثانٍ للشيء نفسه. وفوقه يكون الفراغ **ممرًّا مفتوحًا** فوصلُه يقسم
 * فضاءً واحدًا غرفتين.
 */
export const MAX_END_EXTENSION_M = 1;

/** أقرب مسافةٍ من نقطةٍ إلى قطعة */
function pointToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);

  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
  );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * مدُّ الأطراف الحرّة حتى تبلغ ما تكاد تلمسه.
 *
 * وهذا نظيرُ **الإغلاق المورفولوجي** في مسار الراستر، وأدقّ منه: ذاك
 * يُوسّع كل حاجزٍ في كل اتجاه فيأكل من الغرف الضيّقة، وهذا يمدّ الجدار
 * **على استقامته وحدها** حتى جدارٍ حقيقيّ.
 *
 * والمرور يُعاد: مدُّ طرفٍ قد يُغلق طريقًا لطرفٍ آخر.
 */
export function extendFreeEnds(
  walls: readonly GraphWall[],
  tolerance: number,
  maxExtension: number,
  passes = 2
): { walls: GraphWall[]; extended: number } {
  const current = walls.map((wall) => ({ ...wall }));
  let extended = 0;

  for (let pass = 0; pass < passes; pass += 1) {
    let changedThisPass = false;

    for (let i = 0; i < current.length; i += 1) {
      const wall = current[i];

      for (const end of ["start", "end"] as const) {
        const point =
          end === "start" ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };
        const other =
          end === "start" ? { x: wall.x2, y: wall.y2 } : { x: wall.x1, y: wall.y1 };

        // متّصلٌ أصلًا؟
        const connected = current.some(
          (candidate, index) =>
            index !== i &&
            pointToSegment(point, { x: candidate.x1, y: candidate.y1 }, { x: candidate.x2, y: candidate.y2 }) <=
              tolerance
        );
        if (connected) continue;

        // شعاعٌ على استقامة الجدار، خارجًا من الطرف
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        const length = Math.hypot(dx, dy);
        if (length === 0) continue;
        const ux = dx / length;
        const uy = dy / length;

        let bestDistance = Infinity;
        let bestPoint: Point | null = null;

        for (let j = 0; j < current.length; j += 1) {
          if (j === i) continue;
          const target = current[j];
          const hit = segmentIntersection(
            point,
            { x: point.x + ux * maxExtension, y: point.y + uy * maxExtension },
            { x: target.x1, y: target.y1 },
            { x: target.x2, y: target.y2 }
          );
          if (hit === null) continue;
          if (hit.ta <= 0 || hit.ta > 1) continue;
          // التقاطع داخل الجدار الهدف، بهامش طرفٍ يقبل الملتقى
          const targetLength = Math.hypot(target.x2 - target.x1, target.y2 - target.y1);
          const margin = targetLength > 0 ? tolerance / targetLength : 0;
          if (hit.tb < -margin || hit.tb > 1 + margin) continue;

          const distance = hit.ta * maxExtension;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestPoint = { x: point.x + ux * distance, y: point.y + uy * distance };
          }
        }

        if (bestPoint === null) continue;

        if (end === "start") {
          wall.x1 = bestPoint.x;
          wall.y1 = bestPoint.y;
        } else {
          wall.x2 = bestPoint.x;
          wall.y2 = bestPoint.y;
        }
        extended += 1;
        changedThisPass = true;
      }
    }

    if (!changedThisPass) break;
  }

  return { walls: current, extended };
}

/** مساحة المضلّع بإشارتها (Shoelace) — الإشارة جهةُ الدوران */
export function signedArea(polygon: readonly Point[]): number {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    sum += polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
  }
  return sum / 2;
}

/** محيط المضلّع */
export function perimeter(polygon: readonly Point[]): number {
  let total = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    total += Math.hypot(polygon[i].x - polygon[j].x, polygon[i].y - polygon[j].y);
  }
  return total;
}

/**
 * تفاوت اللحم من سماكات الجدران.
 *
 * من **الوسيط** لا من الأكبر: جدارٌ واحدٌ سميك جدًّا (سياج أو حدّ أرض)
 * يجعل التفاوت هائلًا فيُلحَم ما لا يُلحَم.
 */
export function snapToleranceFor(walls: readonly GraphWall[]): number {
  const thicknesses = walls
    .map((wall) => wall.thickness)
    .filter((value): value is number => value !== null && value > 0)
    .sort((a, b) => a - b);

  if (thicknesses.length === 0) return MIN_SNAP_TOLERANCE;

  const median = thicknesses[Math.floor(thicknesses.length / 2)];
  return median * SNAP_TOLERANCE_THICKNESSES;
}

/**
 * لحم الأطراف المتقاربة إلى نقطةٍ واحدة.
 *
 * بلا لحمٍ لا وجهَ يُغلَق: طرفان يفترقان بميليمترٍ عقدتان مختلفتان،
 * فالحلقة لا تُقفَل وتضيع الغرفة.
 *
 * والعنقود يُمثَّل **بأوّل نقطةٍ فيه** لا بمركزها الحسابي: المركز يزحف
 * مع كل إضافة فتصير النتيجة تابعةً لترتيب المرور، وهذا يجعل قراءة
 * الملف الواحد تختلف بين تشغيلين.
 */
export function snapPoints(
  points: readonly Point[],
  tolerance: number
): { representatives: Point[]; indexOf: number[] } {
  const representatives: Point[] = [];
  const indexOf: number[] = [];

  for (const point of points) {
    let found = -1;
    for (let i = 0; i < representatives.length; i += 1) {
      if (Math.hypot(point.x - representatives[i].x, point.y - representatives[i].y) <= tolerance) {
        found = i;
        break;
      }
    }

    if (found === -1) {
      representatives.push({ x: point.x, y: point.y });
      found = representatives.length - 1;
    }
    indexOf.push(found);
  }

  return { representatives, indexOf };
}

/** موضع نقطةٍ على قطعة: النسبة `t`، أو `null` إن لم تكن عليها */
function parameterOnSegment(
  point: Point,
  a: Point,
  b: Point,
  tolerance: number
): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return null;

  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  if (t < 0 || t > 1) return null;

  const distance = Math.abs(cross(dx, dy, point.x - a.x, point.y - a.y)) / Math.sqrt(lengthSquared);
  return distance <= tolerance ? t : null;
}

/**
 * تقاطع قطعتين — النسبتان على كلٍّ منهما، أو `null` للمتوازيتين.
 */
function segmentIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point
): { ta: number; tb: number } | null {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;

  const denominator = cross(rx, ry, sx, sy);
  if (denominator === 0) return null;

  const ta = cross(b1.x - a1.x, b1.y - a1.y, sx, sy) / denominator;
  const tb = cross(b1.x - a1.x, b1.y - a1.y, rx, ry) / denominator;

  return { ta, tb };
}

/**
 * بناء الشبكة المستوية: تقسيم الجدران عند تقاطعاتها ولحم الأطراف.
 *
 * والتقسيم عند **ملتقى T** لازمٌ كالتقاطع الكامل: قاطعٌ داخليّ ينتهي
 * على جدارٍ خارجيّ يجب أن يقسمه، وإلّا صارت الغرفتان على جانبيه وجهًا
 * واحدًا — وهو أشيعُ شكلٍ في المساكن.
 */
export function buildWallGraph(
  walls: readonly GraphWall[],
  tolerance = snapToleranceFor(walls)
): WallGraph {
  // ١) مواضع التقسيم على كل جدار — النسب مرتّبةً
  const cuts: number[][] = walls.map(() => [0, 1]);

  for (let i = 0; i < walls.length; i += 1) {
    const a1 = { x: walls[i].x1, y: walls[i].y1 };
    const a2 = { x: walls[i].x2, y: walls[i].y2 };

    for (let j = i + 1; j < walls.length; j += 1) {
      const b1 = { x: walls[j].x1, y: walls[j].y1 };
      const b2 = { x: walls[j].x2, y: walls[j].y2 };

      const hit = segmentIntersection(a1, a2, b1, b2);
      if (hit !== null) {
        // التقاطع داخل القطعتين معًا (بهامشٍ يقبل الملتقى عند الطرف)
        const lengthA = Math.hypot(a2.x - a1.x, a2.y - a1.y);
        const lengthB = Math.hypot(b2.x - b1.x, b2.y - b1.y);
        const marginA = lengthA > 0 ? tolerance / lengthA : 0;
        const marginB = lengthB > 0 ? tolerance / lengthB : 0;

        if (
          hit.ta >= -marginA &&
          hit.ta <= 1 + marginA &&
          hit.tb >= -marginB &&
          hit.tb <= 1 + marginB
        ) {
          cuts[i].push(Math.min(1, Math.max(0, hit.ta)));
          cuts[j].push(Math.min(1, Math.max(0, hit.tb)));
          continue;
        }
      }

      // متوازيان أو متقاطعان خارج المدى: يبقى **ملتقى الطرف** — طرفُ
      // أحدهما ملامسًا جسم الآخر. وهذا هو ملتقى T.
      for (const [end, wallIndex, other1, other2] of [
        [b1, i, a1, a2],
        [b2, i, a1, a2],
        [a1, j, b1, b2],
        [a2, j, b1, b2],
      ] as const) {
        const t = parameterOnSegment(end, other1, other2, tolerance);
        if (t !== null) cuts[wallIndex].push(t);
      }
    }
  }

  // ٢) نقاط التقسيم → عقد ملحومة
  const rawPoints: Point[] = [];
  const pieces: { wallIndex: number; fromRaw: number; toRaw: number }[] = [];

  for (let i = 0; i < walls.length; i += 1) {
    const wall = walls[i];
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;

    const ordered = [...new Set(cuts[i])].sort((a, b) => a - b);

    for (let k = 0; k < ordered.length - 1; k += 1) {
      const t0 = ordered[k];
      const t1 = ordered[k + 1];
      // قطعةٌ أقصر من التفاوت لا تُدرَج: تصير عقدتين ملحومتين فحلقةً
      // فارغة
      if (Math.hypot(dx * (t1 - t0), dy * (t1 - t0)) <= tolerance) continue;

      const fromRaw = rawPoints.push({ x: wall.x1 + dx * t0, y: wall.y1 + dy * t0 }) - 1;
      const toRaw = rawPoints.push({ x: wall.x1 + dx * t1, y: wall.y1 + dy * t1 }) - 1;
      pieces.push({ wallIndex: i, fromRaw, toRaw });
    }
  }

  const snapped = snapPoints(rawPoints, tolerance);

  // ٣) الحواف بلا مكرّرٍ ولا حلقةٍ على العقدة نفسها
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const piece of pieces) {
    const from = snapped.indexOf[piece.fromRaw];
    const to = snapped.indexOf[piece.toRaw];
    if (from === to) continue;

    const key = from < to ? `${from}-${to}` : `${to}-${from}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      wallId: walls[piece.wallIndex].id,
      from,
      to,
      thickness: walls[piece.wallIndex].thickness,
    });
  }

  return { nodes: snapped.representatives, edges };
}

export interface Face {
  /** العقد بترتيب الدوران */
  nodes: number[];
  /** الجدران التي تحدّه — بترتيب أضلاعه */
  wallIds: string[];
  /** سماكة كل ضلع، لإزاحته إلى وجه الجدار */
  thicknesses: (number | null)[];
  polygon: Point[];
  area: number;
}

/**
 * استخراج وجوه الشبكة المستوية.
 *
 * المرور بنصف الحواف: من كل حافةٍ موجّهة `u→v` نأخذ عند `v` الجارَ
 * **التالي في اتجاه عقارب الساعة** بعد `u`. وهذا يمرّ بكل وجهٍ مرّةً
 * واحدة، والوجه غير المحدود (الخارج) يخرج بجهة دورانٍ معاكسة — فيُميَّز
 * بإشارته لا بحجمه.
 */
export function extractFaces(graph: WallGraph): Face[] {
  const { nodes, edges } = graph;

  // الجيران مرتّبين بالزاوية حول كل عقدة
  const around: { node: number; angle: number; edgeIndex: number }[][] = nodes.map(() => []);

  edges.forEach((edge, index) => {
    const a = nodes[edge.from];
    const b = nodes[edge.to];
    around[edge.from].push({
      node: edge.to,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      edgeIndex: index,
    });
    around[edge.to].push({
      node: edge.from,
      angle: Math.atan2(a.y - b.y, a.x - b.x),
      edgeIndex: index,
    });
  });

  for (const list of around) list.sort((p, q) => p.angle - q.angle);

  const positionAt = new Map<string, number>();
  around.forEach((list, node) => {
    list.forEach((entry, index) => positionAt.set(`${node}:${entry.node}`, index));
  });

  const visited = new Set<string>();
  const faces: Face[] = [];

  for (const start of edges.flatMap((edge, index) => [
    { from: edge.from, to: edge.to, index },
    { from: edge.to, to: edge.from, index },
  ])) {
    const key = `${start.from}->${start.to}`;
    if (visited.has(key)) continue;

    const faceNodes: number[] = [];
    const faceWalls: string[] = [];
    const faceThickness: (number | null)[] = [];

    let current = start;
    // حدٌّ للأمان: كل نصف حافةٍ يُزار مرّةً، فالحلقة لا تطول أكثر
    for (let guard = 0; guard <= edges.length * 2; guard += 1) {
      const stepKey = `${current.from}->${current.to}`;
      if (visited.has(stepKey)) break;
      visited.add(stepKey);

      faceNodes.push(current.from);
      faceWalls.push(edges[current.index].wallId);
      faceThickness.push(edges[current.index].thickness);

      const list = around[current.to];
      const position = positionAt.get(`${current.to}:${current.from}`);
      if (position === undefined || list.length === 0) break;

      // الجار السابق في الترتيب الزاويّ = التالي باتجاه عقارب الساعة
      const next = list[(position - 1 + list.length) % list.length];
      current = { from: current.to, to: next.node, index: next.edgeIndex };

      if (current.from === start.from && current.to === start.to) break;
    }

    if (faceNodes.length < 3) continue;

    const polygon = faceNodes.map((node) => nodes[node]);
    faces.push({
      nodes: faceNodes,
      wallIds: faceWalls,
      thicknesses: faceThickness,
      polygon,
      area: signedArea(polygon),
    });
  }

  return faces;
}

/**
 * الوجوه المحدودة وحدها — بإسقاط الوجه الخارجي لكل مكوّن.
 *
 * والتمييز **بالإشارة لا بالحجم**: قاعدة المرور تُخرج الوجوه المحدودة
 * بجهةٍ والخارجَ بالجهة المعاكسة. والحجم يفشل مع مخططٍ فيه مبنيان: لكلٍّ
 * وجهٌ خارجيّ، وأحدهما أصغر من غرفةٍ في الآخر.
 */
export function boundedFaces(faces: readonly Face[]): Face[] {
  if (faces.length === 0) return [];

  // إشارة الوجه الخارجي: أكبر وجهٍ بالمساحة المطلقة خارجيٌّ قطعًا
  const largest = faces.reduce((best, face) =>
    Math.abs(face.area) > Math.abs(best.area) ? face : best
  );
  const outerSign = Math.sign(largest.area);

  return faces.filter((face) => face.area !== 0 && Math.sign(face.area) !== outerSign);
}

/**
 * إزاحة حدّ الوجه إلى **وجه الجدار الداخلي**.
 *
 * وجوه الشبكة على الخطوط الوسطى، والغرفة تنتهي عند وجه الجدار — فبلا
 * إزاحةٍ تُحسَب مساحة الغرفة زائدةً بنصف سماكةٍ على كل حدّ. وفي غرفة
 * ٤×٣ م بجدار ٢٥ سم فرقٌ يقارب **١.٨ م²**، أي ١٥٪.
 *
 * والإزاحة على **خطوط الأضلاع** ثم تقاطعها: إزاحةُ الرؤوس مباشرةً
 * تفسد الزوايا غير القائمة، وتقاطعُ الخطوط صحيحٌ بأي زاوية.
 */
export function insetFace(face: Face): Point[] {
  const count = face.polygon.length;
  if (count < 3) return [...face.polygon];

  // جهة الداخل: موجبةُ المساحة تعني دورانًا في جهةٍ، والعمودي الداخلي
  // يتبعها
  const inwardSign = face.area > 0 ? 1 : -1;

  const lines = face.polygon.map((point, index) => {
    const next = face.polygon[(index + 1) % count];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return null;

    // العمودي على الضلع، موجَّهًا إلى الداخل
    const nx = (-dy / length) * inwardSign;
    const ny = (dx / length) * inwardSign;

    const offset = (face.thicknesses[index] ?? 0) / 2;
    return {
      x: point.x + nx * offset,
      y: point.y + ny * offset,
      dx,
      dy,
    };
  });

  const inset: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const previous = lines[(i - 1 + count) % count];
    const current = lines[i];
    if (previous === null || current === null) {
      inset.push(face.polygon[i]);
      continue;
    }

    const denominator = cross(previous.dx, previous.dy, current.dx, current.dy);
    if (Math.abs(denominator) < 1e-12) {
      // ضلعان على استقامةٍ واحدة: لا تقاطع، والنقطة المُزاحة تكفي
      inset.push({ x: current.x, y: current.y });
      continue;
    }

    const t =
      cross(current.x - previous.x, current.y - previous.y, current.dx, current.dy) / denominator;
    inset.push({ x: previous.x + previous.dx * t, y: previous.y + previous.dy * t });
  }

  return inset;
}

/**
 * حذف الرؤوس على استقامةٍ واحدة.
 *
 * ملتقى T يُقسم الجدار عند نقطةٍ حقيقية، فيظهر في مضلّع الغرفة المجاورة
 * رأسًا **على استقامة ضلعها**. وهو لا يُغيّر المساحة، لكنه يُثقل المضلّع
 * ويُوهم المراجع أن هناك انكسارًا حيث لا انكسار.
 *
 * والحدّ نسبيّ لا مطلق: انحرافُ ميليمترٍ على ضلعٍ طوله متر انكسارٌ
 * حقيقيّ، وعلى ضلعٍ طوله مئة متر خطأُ فاصلةٍ عائمة.
 */
export function dropCollinear(polygon: readonly Point[], relativeEpsilon = 1e-9): Point[] {
  if (polygon.length < 4) return [...polygon];

  const kept: Point[] = [];
  const count = polygon.length;

  for (let i = 0; i < count; i += 1) {
    const previous = polygon[(i - 1 + count) % count];
    const current = polygon[i];
    const next = polygon[(i + 1) % count];

    const ax = current.x - previous.x;
    const ay = current.y - previous.y;
    const bx = next.x - current.x;
    const by = next.y - current.y;

    const scale = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by));
    if (scale === 0) continue;

    if (Math.abs(cross(ax, ay, bx, by)) / (scale * scale) > relativeEpsilon) {
      kept.push(current);
    }
  }

  // مضلّعٌ انطبقت أضلاعه كلّها على استقامةٍ واحدة ليس مضلّعًا
  return kept.length >= 3 ? kept : [...polygon];
}

export interface ReconstructedRoom {
  polygon: Point[];
  area: number;
  perimeter: number;
  /** الجدران التي تحدّ الغرفة، بلا تكرار ومرتّبةً */
  wallIds: string[];
}

export interface ReconstructOptions {
  /** أصغر مساحةٍ تُعَدّ غرفة بوحدة النموذج المربّعة */
  minArea?: number;
  tolerance?: number;
  /** أوسع فجوةٍ تُوصَل — بوحدة النموذج */
  maxBridgeGap?: number;
  /**
   * ما يُغلق فتحات الجدران: امتداد النوافذ في الزجاج، وسَدّات الأبواب
   * المقيسة.
   *
   * **والغلاف لا يُغلَق بلا هذا** — قِيس على ملف العميل: الجانب الأيسر
   * من البيت جدارٌ بطول ٢.٨٧ م ثم **٣.٥٥ م زجاجًا**، فالزجاج ليس جدارًا
   * في الملف ولا يُقرأ منه، لكنه **يحدّ الغرفة**. وبلا إدراجه يبقى
   * الغلاف مفتوحًا فلا حلقةَ فلا غرفة.
   *
   * والباب كذلك: قاطعٌ ينتهي متـرًا تحت السقف فجوتُه بابٌ لا فراغ،
   * وسَدّته تُغلق الحلقة.
   */
  closures?: readonly GraphWall[];
  /** أقصى مدٍّ لطرفٍ حرّ — بوحدة النموذج */
  maxEndExtension?: number;
}

/**
 * أصغر مساحةٍ تُعَدّ غرفة — بالمتر المربّع.
 *
 * دونها تكون المنطقة تجويفَ جدارٍ أو مثلّثَ ملتقى، لا غرفةً يُشترى لها
 * بلاطٌ ودهان.
 */
export const MIN_ROOM_AREA_M2 = 1.2;

/**
 * بناء مضلّعات الغرف من الجدران.
 *
 * `minArea` بوحدة النموذج المربّعة — يُمرَّر لأن الوحدة للمُستدعي.
 */
export function reconstructRooms(
  walls: readonly GraphWall[],
  options: ReconstructOptions = {}
): { rooms: ReconstructedRoom[]; graph: WallGraph; basisAr: string } {
  const tolerance = options.tolerance ?? snapToleranceFor(walls);

  // الغلاف = الجدران + ما يُغلق فتحاتها. والزجاج وسَدّات الأبواب ليست
  // جدرانًا تُحسَب، لكنها **تحدّ الغرف** — وبلا إدراجها يبقى الغلاف
  // مفتوحًا فلا حلقةَ فلا غرفة.
  const enclosure = [...walls, ...(options.closures ?? [])];

  // الوصل قبل الشبكة: الجدار مقطوعٌ عند كل باب ونافذة في الملف، وبلا
  // وصلٍ **لا حلقة في الشبكة أصلًا** فلا غرفة
  const joined = bridgeCollinearWalls(
    enclosure,
    tolerance,
    options.maxBridgeGap ?? MAX_BRIDGE_GAP_M
  );

  // ثم مدُّ الأطراف الحرّة: القاطع ينتهي دون الجدار المقابل بفجوة بابٍ
  // لم تُرسَم درفته، فلا شيء يسدّها ولا حلقةَ تُغلَق
  const closed = extendFreeEnds(
    joined.walls,
    tolerance,
    options.maxEndExtension ?? MAX_END_EXTENSION_M
  );

  const graph = buildWallGraph(closed.walls, tolerance);
  const faces = extractFaces(graph);
  const bounded = boundedFaces(faces);

  const minArea = options.minArea ?? 0;
  const rooms: ReconstructedRoom[] = [];
  let tooSmall = 0;

  for (const face of bounded) {
    const polygon = dropCollinear(insetFace(face));
    const area = Math.abs(signedArea(polygon));

    if (area < minArea) {
      tooSmall += 1;
      continue;
    }

    rooms.push({
      polygon,
      area,
      perimeter: perimeter(polygon),
      wallIds: [...new Set(face.wallIds)].sort(),
    });
  }

  // الأكبر أولًا — ترتيبٌ حتميّ لا يتبع ترتيب المرور
  rooms.sort((a, b) => b.area - a.area || a.polygon[0].x - b.polygon[0].x);

  const basisParts = [
    `${rooms.length} غرفة من شبكة الجدران: ${graph.nodes.length} عقدة و${graph.edges.length} قطعة، ` +
      `وحدُّ كل غرفةٍ مُزاحٌ إلى وجه جدارها الداخلي.`,
  ];
  if (closed.extended > 0) {
    basisParts.push(
      `و${closed.extended} طرفًا حرًّا مُدَّ على استقامته حتى بلغ جدارًا (فجوةُ بابٍ لم تُرسَم ` +
        `درفته) — والمدّ لا يتجاوز ${(options.maxEndExtension ?? MAX_END_EXTENSION_M)} م، ` +
        `فالفراغ الأوسع ممرٌّ مفتوح لا باب.`
    );
  }
  if (joined.bridged > 0) {
    basisParts.push(
      `و${joined.bridged} فجوةً وُصِلت على استقامةٍ واحدة — الجدار مقطوعٌ في الملف عند كل ` +
        `فتحة، والفتحات مستخرجةٌ مستقلّةً فلا تُخفيها الوصلة.`
    );
  }
  if (tooSmall > 0) {
    basisParts.push(`و${tooSmall} وجهًا أصغر من حدّ الغرفة أُسقط (تجويف جدارٍ أو مثلّث ملتقى).`);
  }

  return { rooms, graph, basisAr: basisParts.join(" ") };
}
