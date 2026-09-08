// ============================================================
// من كيانات IFC إلى مخطط
// ============================================================
// لا سؤال معماري هنا. في مسار الصورة نسأل: أيّ بكسل حبر؟ وفي DXF:
// أيّ خطّين وجهان لجدار وأيّ قوس بابٌ ولأيّ جدار؟ وفي IFC **الملف
// يجيب**: هذا `IFCWALL`، وهذه `IFCOPENINGELEMENT` في ذلك الجدار،
// يملؤها `IFCDOOR`.
//
// فما يبقى عملٌ حسابي بحت: تحويل الإحداثيات المحلّية إلى عالمية، وقراءة
// السماكة من طبقات المادة، والطول من محور الجدار، والارتفاع من عمق
// البثق. وكلّها أرقامٌ مكتوبة.
//
// **والارتفاع هو المكسب الذي لا يُعطيه أي مسار آخر**: مسار الصورة
// ومسار DXF كلاهما مسطَّح تمامًا، فارتفاع الجدار وارتفاع الباب
// مجهولان. ومساحة الدهان = الطول × الارتفاع − الفتحات. فبلا ارتفاع
// تبقى أكبر كمية في المشروع تقديرًا.

import {
  entitiesOfType,
  enumAt,
  listAt,
  numberAt,
  numbersAt,
  refAt,
  refsAt,
  stringAt,
  type IfcDocument,
  type IfcEntity,
} from "./parse";

/** جدار مقروء من IFC، بالمتر */
export interface IfcWall {
  /** مُعرَّف الكيان في الملف — يبقى ثابتًا فتُنسَب إليه الفتحات */
  entityId: number;
  name: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  /** ارتفاع الجدار بالمتر — `null` إن لم يُعلَن. لا يُفترَض */
  heightM: number | null;
}

/** فتحة مقروءة من IFC، بالمتر */
export interface IfcOpening {
  operation?: string;
  leafCount?: 1 | 2;
  /** الجدار الذي تُفرّغه، بمُعرَّف كيانه */
  wallEntityId: number;
  /** نسبة الموضع على طول محور الجدار 0..1 */
  position: number;
  widthM: number;
  /** ارتفاع الفتحة — `null` إن لم يُعلَن */
  heightM: number | null;
  /** من `IFCRELFILLSELEMENT`: بابٌ أو نافذةٌ أو غير معلوم */
  kind: "door" | "window" | "unknown";
  name: string | null;
}

export interface IfcPlan {
  spaces?: { entityId: number; name: string | null; polygon: { x: number; y: number }[]; areaM2: number }[];
  walls: IfcWall[];
  openings: IfcOpening[];
  basis: string;
  confidence: number;
}

/** موضعٌ ثنائي الأبعاد: نقطة واتجاه مرجعي */
interface Placement2D {
  x: number;
  y: number;
  /** جيب وجيب تمام اتجاه المحور المرجعي */
  cos: number;
  sin: number;
}

const IDENTITY: Placement2D = { x: 0, y: 0, cos: 1, sin: 0 };

/** ضمّ موضعٍ محلّي إلى موضعٍ أبٍ */
function compose(parent: Placement2D, local: Placement2D): Placement2D {
  return {
    x: parent.x + local.x * parent.cos - local.y * parent.sin,
    y: parent.y + local.x * parent.sin + local.y * parent.cos,
    cos: parent.cos * local.cos - parent.sin * local.sin,
    sin: parent.sin * local.cos + parent.cos * local.sin,
  };
}

/** نقل نقطة محلّية إلى فضاء الموضع */
function apply(placement: Placement2D, x: number, y: number): { x: number; y: number } {
  return {
    x: placement.x + x * placement.cos - y * placement.sin,
    y: placement.y + x * placement.sin + y * placement.cos,
  };
}

/** قراءة `IFCAXIS2PLACEMENT2D/3D` موضعًا مستويًا */
function readAxisPlacement(doc: IfcDocument, id: number | null): Placement2D {
  if (id === null) return IDENTITY;
  const entity = doc.entities.get(id);
  if (!entity) return IDENTITY;

  const locationId = refAt(entity, 0);
  const location = locationId === null ? undefined : doc.entities.get(locationId);
  const coords = numbersAt(location, 0);

  // ‎3D يضع المحور في الموضع ١ والمرجع في ٢، و2D يضع المرجع في ١
  const refIndex = entity.type === "IFCAXIS2PLACEMENT2D" ? 1 : 2;
  const refId = refAt(entity, refIndex);
  const reference = refId === null ? undefined : doc.entities.get(refId);
  const ratios = numbersAt(reference, 0);

  const dx = ratios[0] ?? 1;
  const dy = ratios[1] ?? 0;
  const length = Math.hypot(dx, dy);

  return {
    x: coords[0] ?? 0,
    y: coords[1] ?? 0,
    // اتجاهٌ بطول صفر لا يُعرّف دورانًا — تُستخدم الهوية لا NaN
    cos: length === 0 ? 1 : dx / length,
    sin: length === 0 ? 0 : dy / length,
  };
}

/**
 * أقصى عمق لسلسلة المواضع.
 *
 * `IFCLOCALPLACEMENT` سلسلةٌ: الجدار نسبةً للطابق، والطابق للمبنى،
 * والمبنى للموقع. وملفٌ فاسد قد يجعلها حلقة، فبلا سقفٍ يدور الحلّ
 * أبديًا ويُعلَّق المتصفّح. والعمق الحقيقي أربعة أو خمسة.
 */
export const MAX_PLACEMENT_DEPTH = 16;

/** حلّ سلسلة `IFCLOCALPLACEMENT` إلى موضعٍ عالمي */
export function resolvePlacement(doc: IfcDocument, id: number | null): Placement2D {
  const chain: Placement2D[] = [];
  let current = id;
  let depth = 0;

  while (current !== null && depth < MAX_PLACEMENT_DEPTH) {
    const entity = doc.entities.get(current);
    if (!entity || entity.type !== "IFCLOCALPLACEMENT") break;
    chain.push(readAxisPlacement(doc, refAt(entity, 1)));
    current = refAt(entity, 0);
    depth += 1;
  }

  // من الجدّ إلى الابن: الأبعد في السلسلة هو الأب
  let result = IDENTITY;
  for (let i = chain.length - 1; i >= 0; i -= 1) result = compose(result, chain[i]);
  return result;
}

/** تمثيلات الشكل بمُعرِّفها ('Axis' أو 'Body') */
function representations(doc: IfcDocument, shapeId: number | null): Map<string, IfcEntity[]> {
  const out = new Map<string, IfcEntity[]>();
  if (shapeId === null) return out;
  const shape = doc.entities.get(shapeId);
  if (!shape) return out;

  for (const id of refsAt(shape, 2)) {
    const representation = doc.entities.get(id);
    if (!representation || representation.type !== "IFCSHAPEREPRESENTATION") continue;
    const identifier = stringAt(representation, 1) ?? "";
    const items = refsAt(representation, 3)
      .map((itemId) => doc.entities.get(itemId))
      .filter((item): item is IfcEntity => item !== undefined);
    out.set(identifier, items);
  }

  return out;
}

/**
 * نقاط منحنى مستوي: `IFCPOLYLINE` أو `IFCINDEXEDPOLYCURVE`.
 *
 * الأول يُشير إلى نقاطٍ فرادى، والثاني إلى قائمة إحداثيات مضغوطة.
 * والمُصدِّرات تستخدم الاثنين، فقراءة أحدهما تُفقِد محور نصف الملفات.
 */
export function curvePoints(
  doc: IfcDocument,
  item: IfcEntity
): { x: number; y: number }[] {
  if (item.type === "IFCPOLYLINE") {
    return refsAt(item, 0)
      .map((id) => numbersAt(doc.entities.get(id), 0))
      .filter((coords) => coords.length >= 2)
      .map((coords) => ({ x: coords[0], y: coords[1] }));
  }

  if (item.type === "IFCINDEXEDPOLYCURVE") {
    const listId = refAt(item, 0);
    const list = listId === null ? undefined : doc.entities.get(listId);
    return listAt(list, 0)
      .filter((value): value is { kind: "list"; items: never[] } => value.kind === "list")
      .map((value) => value.items)
      .map((items) =>
        items
          .filter((v: { kind: string }) => v.kind === "number")
          .map((v: { value: number }) => v.value)
      )
      .filter((coords) => coords.length >= 2)
      .map((coords) => ({ x: coords[0], y: coords[1] }));
  }

  return [];
}

/** مقطعٌ مستطيل: `IFCRECTANGLEPROFILEDEF` → عرضٌ وعمق */
function rectangleProfile(entity: IfcEntity | undefined): { x: number; y: number } | null {
  if (!entity || entity.type !== "IFCRECTANGLEPROFILEDEF") return null;
  const x = numberAt(entity, 3);
  const y = numberAt(entity, 4);
  return x !== null && y !== null ? { x, y } : null;
}

/** أول جسمٍ مبثوق في تمثيل، بمقطعه وعمقه */
function extrusion(
  doc: IfcDocument,
  items: readonly IfcEntity[]
): { profile: IfcEntity | undefined; depth: number | null } | null {
  for (const item of items) {
    if (item.type !== "IFCEXTRUDEDAREASOLID") continue;
    const profileId = refAt(item, 0);
    return {
      profile: profileId === null ? undefined : doc.entities.get(profileId),
      depth: numberAt(item, 3),
    };
  }
  return null;
}

/**
 * سماكة الجدار من طبقات مادته.
 *
 * `IFCRELASSOCIATESMATERIAL` تربط الجدار بـ`IFCMATERIALLAYERSETUSAGE`
 * أو مباشرةً بـ`IFCMATERIALLAYERSET`، ومجموع سماكات الطبقات هو سماكة
 * الجدار. وقد تُربط بنوع الجدار لا بالجدار نفسه، فيُتبَع النوع كذلك.
 *
 * يُعيد `null` عند الغياب لا صفرًا: جدارٌ بلا سماكة لا يفصل غرفتين،
 * ولا يُحسَب له بناء.
 */
export function materialThickness(
  doc: IfcDocument,
  entityId: number,
  associations: ReadonlyMap<number, number[]>
): number | null {
  for (const materialId of associations.get(entityId) ?? []) {
    let setId: number | null = materialId;
    const material = doc.entities.get(materialId);

    if (material?.type === "IFCMATERIALLAYERSETUSAGE") setId = refAt(material, 0);
    const layerSet = setId === null ? undefined : doc.entities.get(setId);
    if (layerSet?.type !== "IFCMATERIALLAYERSET") continue;

    let total = 0;
    for (const layerId of refsAt(layerSet, 0)) {
      const thickness = numberAt(doc.entities.get(layerId), 1);
      if (thickness !== null && thickness > 0) total += thickness;
    }
    if (total > 0) return total;
  }

  return null;
}

/** خريطة كيان ← موادّه المرتبطة، ومعها موادّ نوعه */
function materialAssociations(doc: IfcDocument): Map<number, number[]> {
  const direct = new Map<number, number[]>();

  for (const relation of entitiesOfType(doc, "IFCRELASSOCIATESMATERIAL")) {
    const materialId = refAt(relation, 5);
    if (materialId === null) continue;
    for (const objectId of refsAt(relation, 4)) {
      const existing = direct.get(objectId);
      if (existing) existing.push(materialId);
      else direct.set(objectId, [materialId]);
    }
  }

  // موادّ النوع تُورَّث للنُسخ: المُصدِّر يضع طبقات الجدار على
  // `IFCWALLTYPE` مرّةً واحدة لا على كل جدار
  for (const relation of entitiesOfType(doc, "IFCRELDEFINESBYTYPE")) {
    const typeId = refAt(relation, 5);
    if (typeId === null) continue;
    const fromType = direct.get(typeId);
    if (!fromType) continue;
    for (const objectId of refsAt(relation, 4)) {
      const existing = direct.get(objectId);
      // موادّ الجدار نفسه أولى من موادّ نوعه
      if (existing) existing.push(...fromType);
      else direct.set(objectId, [...fromType]);
    }
  }

  return direct;
}

/** حدود سماكة الجدار المعقولة بالمتر — من ممارسة البناء */
export const MIN_IFC_THICKNESS_M = 0.03;
export const MAX_IFC_THICKNESS_M = 1.5;

/**
 * استخراج مخطط من مستند IFC.
 *
 * `metersPerUnit` يُمرَّر لا يُفترض، ويُقرأ من `IFCUNITASSIGNMENT`.
 */
export function ifcToPlan(doc: IfcDocument, metersPerUnit: number): IfcPlan {
  const associations = materialAssociations(doc);
  const walls: IfcWall[] = [];
  let missingThickness = 0;
  let missingHeight = 0;
  /** جدرانٌ بلا محورٍ ولا مقطعٍ مستطيل — لا طول لها ولا سماكة */
  let missingGeometry = 0;

  for (const entity of entitiesOfType(doc, "IFCWALL", "IFCWALLSTANDARDCASE")) {
    const placement = resolvePlacement(doc, refAt(entity, 5));
    const shapes = representations(doc, refAt(entity, 6));

    // الطول والاتجاه من محور الجدار إن وُجد — وهو الأدقّ لأنه المحور
    // نفسه لا مستطيلٌ يُستنتَج منه
    let start: { x: number; y: number } | null = null;
    let end: { x: number; y: number } | null = null;

    for (const item of shapes.get("Axis") ?? []) {
      const points = curvePoints(doc, item);
      if (points.length >= 2) {
        start = apply(placement, points[0].x, points[0].y);
        end = apply(placement, points[points.length - 1].x, points[points.length - 1].y);
        break;
      }
    }

    const body = extrusion(doc, shapes.get("Body") ?? []);
    const profile = rectangleProfile(body?.profile);

    // بلا محورٍ: يُستنتَج من المقطع المستطيل. المقطع مركزيٌّ في IFC،
    // فالمحور يمتدّ نصف العرض على كل جهة من نقطة الموضع.
    if ((!start || !end) && profile) {
      start = apply(placement, -profile.x / 2, 0);
      end = apply(placement, profile.x / 2, 0);
    }

    // بلا محورٍ ولا مقطعٍ مستطيل لا طولَ ولا سماكة. وهذا يقع فعلًا:
    // في ملف العميل «Foundation Skirt» مقطعها `ARBITRARYPROFILEDEFWITHVOIDS`
    // (حدّ الأساس بفراغاته) وليست جدارًا يحدّ غرفة. فتُستثنى — لكن
    // **تُعَدّ وتُبلَّغ**، فالإسقاط الصامت يُخفي جدارًا حقيقيًا لو حدث.
    if (!start || !end) {
      missingGeometry += 1;
      continue;
    }

    // السماكة من المادة أولًا (معلنة صريحًا)، ثم من عمق المقطع
    const declared = materialThickness(doc, entity.id, associations);
    const thickness = declared ?? profile?.y ?? null;
    if (thickness === null) {
      missingThickness += 1;
      continue;
    }

    const thicknessM = thickness * metersPerUnit;
    // جدارٌ خارج حدود البناء ليس جدارًا — لا يُقبَل ولا تُصحَّح سماكته
    if (thicknessM < MIN_IFC_THICKNESS_M || thicknessM > MAX_IFC_THICKNESS_M) continue;

    const heightM = body?.depth === null || body?.depth === undefined
      ? null
      : body.depth * metersPerUnit;
    if (heightM === null) missingHeight += 1;

    const length = Math.hypot(end.x - start.x, end.y - start.y);
    // جدارٌ بطول صفر لا موضع له ولا كمية — يُهمَل
    if (length * metersPerUnit < MIN_IFC_THICKNESS_M) continue;

    walls.push({
      entityId: entity.id,
      name: stringAt(entity, 2),
      x1: start.x * metersPerUnit,
      y1: start.y * metersPerUnit,
      x2: end.x * metersPerUnit,
      y2: end.y * metersPerUnit,
      thickness: thicknessM,
      heightM,
    });
  }

  const openings = extractOpenings(doc, metersPerUnit, walls);

  const withHeight = walls.filter((wall) => wall.heightM !== null).length;
  const basisParts = [
    `${walls.length} جدارًا من كيانات \`IFCWALL\` — الملف **يصرّح** بأنها جدران، ` +
      `فلا تزويج وجهين ولا عتبة حبر ولا تخمين.`,
    withHeight > 0
      ? `و**ارتفاع ${withHeight} منها معلوم** من عمق البثق — وهو مجهول تمامًا في ` +
        `مسار الصورة وفي DXF، ومساحة الدهان تُحسَب به.`
      : `ولا ارتفاع معلنًا في الملف، فمساحة الدهان تبقى بحاجة إلى ارتفاع يُدخَل.`,
    openings.length > 0
      ? `و${openings.length} فتحة من \`IFCOPENINGELEMENT\`: الجدار الحامل لها معلن في ` +
        `\`IFCRELVOIDSELEMENT\` لا مُستنتَجًا بالقرب، ونوعها (باب/نافذة) من ` +
        `\`IFCRELFILLSELEMENT\`.`
      : `ولا فتحات معلنة في الملف.`,
  ];
  if (missingGeometry > 0) {
    basisParts.push(
      `و${missingGeometry} كيانًا من نوع جدار بلا محورٍ ولا مقطعٍ مستطيل فلم يُدرَج ` +
        `(حدُّ أساسٍ أو عنصرٌ غير حاجزٍ في الغالب) — لا يُخمَّن له طول.`
    );
  }
  if (missingThickness > 0) {
    basisParts.push(`و${missingThickness} جدارًا بلا سماكة معلنة فلم يُدرَج — لا تُخمَّن سماكة.`);
  }
  if (missingHeight > 0) {
    basisParts.push(`و${missingHeight} جدارًا بلا ارتفاع معلن، فارتفاعه يبقى فارغًا لا مُقدَّرًا.`);
  }

  return {
    walls,
    openings,
    spaces: extractSpaces(doc, metersPerUnit),
    basis: basisParts.join(" "),
    // أعلى من DXF: هناك يبقى تمييز الجدار من غيره اجتهادًا بالطبقة،
    // وهنا الملف يصرّح بالنوع. ولا تبلغ ١: الغرف تبقى من الملء لأن
    // هذا الملف بلا `IFCSPACE`.
    confidence: 0.98,
  };
}

/**
 * الفتحات وعلاقاتها.
 *
 * هذا أنقى ما في IFC: `IFCRELVOIDSELEMENT` تقول أيّ جدار تُفرّغه
 * الفتحة، و`IFCRELFILLSELEMENT` تقول أيّ باب أو نافذة يملؤها. فلا
 * نسبةَ قوسٍ إلى أقرب جدار بتفاوت، ولا تمييزَ نافذةٍ من إطارها.
 */
function extractOpenings(
  doc: IfcDocument,
  metersPerUnit: number,
  walls: readonly IfcWall[]
): IfcOpening[] {
  /** الفتحة ← الجدار الذي تُفرّغه */
  const voids = new Map<number, number>();
  for (const relation of entitiesOfType(doc, "IFCRELVOIDSELEMENT")) {
    const wallId = refAt(relation, 4);
    const openingId = refAt(relation, 5);
    if (wallId !== null && openingId !== null) voids.set(openingId, wallId);
  }

  /** الفتحة ← ما يملؤها */
  const fills = new Map<number, number>();
  for (const relation of entitiesOfType(doc, "IFCRELFILLSELEMENT")) {
    const openingId = refAt(relation, 4);
    const fillerId = refAt(relation, 5);
    if (openingId !== null && fillerId !== null) fills.set(openingId, fillerId);
  }

  const wallById = new Map(walls.map((wall) => [wall.entityId, wall]));
  const openings: IfcOpening[] = [];

  for (const entity of entitiesOfType(doc, "IFCOPENINGELEMENT")) {
    const wallEntityId = voids.get(entity.id);
    // فتحةٌ بلا جدارٍ معلن لا موضع لها — تُهمَل ولا تُلحَق بأقربه
    if (wallEntityId === undefined) continue;
    const wall = wallById.get(wallEntityId);
    if (!wall) continue;

    const shapes = representations(doc, refAt(entity, 6));
    const body = extrusion(doc, shapes.get("Body") ?? []);
    const profile = rectangleProfile(body?.profile);
    // بلا مقطعٍ مستطيل لا عرض معلوم — والعرض يُخصَم من الدهان ويُشترى
    // به بابٌ، فلا يُخمَّن
    if (!profile) continue;

    // موضع الفتحة نسبةً لموضع الجدار: الإحداثي المحلّي س هو المسافة
    // على محور الجدار من نقطة بدايته
    const openingPlacement = resolvePlacement(doc, refAt(entity, 5));
    const wallLength = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    if (wallLength === 0) continue;

    const alongX = openingPlacement.x * metersPerUnit - wall.x1;
    const alongY = openingPlacement.y * metersPerUnit - wall.y1;
    const t =
      ((alongX * (wall.x2 - wall.x1)) / wallLength +
        (alongY * (wall.y2 - wall.y1)) / wallLength) /
      wallLength;

    const filler = fills.get(entity.id);
    const fillerEntity = filler === undefined ? undefined : doc.entities.get(filler);
    const kind =
      fillerEntity?.type === "IFCDOOR"
        ? "door"
        : fillerEntity?.type === "IFCWINDOW"
          ? "window"
          : "unknown";

    const operation = kind === "door" ? doorOperation(doc, fillerEntity) : undefined;
    openings.push({
      ...(operation ? { operation, leafCount: operation.startsWith("DOUBLE_DOOR") ? 2 as const : 1 as const } : {}),
      wallEntityId,
      position: Math.max(0, Math.min(1, t)),
      widthM: (numberAt(fillerEntity, 9) ?? profile.x) * metersPerUnit,
      heightM:
        body?.depth === null || body?.depth === undefined
          ? null
          : body.depth * metersPerUnit,
      kind,
      // اسم الباب في المكتبة (مثل `door-interior-single_32in`) — يُفيد
      // في المطابقة مع منتجٍ حقيقي لاحقًا
      name: stringAt(fillerEntity, 2) ?? stringAt(entity, 2),
    });
  }

  return openings;
}

// Preserve explicit IFCSPACE labels and boundaries instead of discarding provider rooms.
export function extractSpaces(doc: IfcDocument, units: number) {
  const spaces = [];
  for (const entity of entitiesOfType(doc, "IFCSPACE")) {
    const shapes = representations(doc, refAt(entity, 6));
    const solid = (shapes.get("Body") || []).find(e => e.type === "IFCEXTRUDEDAREASOLID");
    if (!solid) continue;
    const profileId = refAt(solid, 0), profile = profileId === null ? undefined : doc.entities.get(profileId);
    if (!profile) continue;
    const rect = rectangleProfile(profile);
    let points: { x: number; y: number }[] = [];
    if (rect) points = [{x:-rect.x/2,y:-rect.y/2},{x:rect.x/2,y:-rect.y/2},{x:rect.x/2,y:rect.y/2},{x:-rect.x/2,y:rect.y/2}];
    else if (profile.type === "IFCARBITRARYCLOSEDPROFILEDEF") {
      const curveId = refAt(profile, 2), curve = curveId === null ? undefined : doc.entities.get(curveId);
      if (curve) points = curvePoints(doc, curve);
    }
    if (points.length < 3) continue;
    let placement = compose(resolvePlacement(doc, refAt(entity, 5)), readAxisPlacement(doc, refAt(solid, 1)));
    if (rect) placement = compose(placement, readAxisPlacement(doc, refAt(profile, 2)));
    const polygon = points.map(p => { const q = apply(placement, p.x, p.y); return {x:q.x*units,y:q.y*units}; });
    const areaM2 = Math.abs(polygon.reduce((sum, p, i) => { const q = polygon[(i+1)%polygon.length]; return sum+p.x*q.y-q.x*p.y; },0))/2;
    if (areaM2 > .1) spaces.push({entityId:entity.id,name:stringAt(entity,8) || stringAt(entity,2),polygon,areaM2});
  }
  return spaces;
}

export function doorOperation(doc: IfcDocument, door: IfcEntity | undefined): string | undefined {
  if (!door) return undefined;
  let operation = enumAt(door, 11);
  if (!operation || operation === "NOTDEFINED") {
    for (const relation of entitiesOfType(doc, "IFCRELDEFINESBYTYPE")) {
      if (!refsAt(relation, 4).includes(door.id)) continue;
      const id = refAt(relation, 5);
      const type = id === null ? undefined : doc.entities.get(id);
      if (type?.type === "IFCDOORTYPE") operation = enumAt(type, 10);
      if (type?.type === "IFCDOORSTYLE") operation = enumAt(type, 8);
    }
  }
  return operation && operation !== "NOTDEFINED" && operation !== "USERDEFINED" ? operation : undefined;
}

/** هل يبدو النصّ ملف IFC؟ — بنيةٌ لا بايتات سحرية */
export function isIfcContent(text: string): boolean {
  return /ISO-10303-21/.test(text) && /FILE_SCHEMA/.test(text) && /\bDATA;/.test(text);
}

/** نوع الفتحة المعلن — للاستعمال في التقارير */
export function openingKindLabel(kind: IfcOpening["kind"]): string {
  switch (kind) {
    case "door":
      return "باب";
    case "window":
      return "نافذة";
    default:
      return "فتحة غير محدّدة النوع";
  }
}
