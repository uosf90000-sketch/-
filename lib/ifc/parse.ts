// ============================================================
// قراءة IFC — المبنى موصوفًا لا مرسومًا
// ============================================================
// كل ما سبق كان استعادة معنًى من **رسم**: من بكسلات في مسار الصورة،
// ومن خطوط ومضلّعات في مسار DXF. وحتى في DXF بقي السؤال المعماري
// قائمًا: أيّ خطّين وجهان لجدار؟ وأيّ قوس بابٌ ولأيّ جدار ينتمي؟
//
// وIFC ليس رسمًا بل **وصفٌ للمبنى**. فيه:
//
//   - `IFCWALL` كيانٌ اسمه جدار، له محورٌ وطولٌ و**سماكة معلنة** في
//     طبقات مادته، و**ارتفاعٌ** هو عمق البثق. والارتفاع مجهول تمامًا
//     في المسارين الآخرين — والدهان يُحسَب بالطول × الارتفاع.
//   - `IFCDOOR` و`IFCWINDOW` كيانان صريحان، ولا يُستنتَجان من قوس.
//   - `IFCOPENINGELEMENT` مع `IFCRELVOIDSELEMENT`: الفتحة تقول **في
//     أيّ جدار** هي، بلا تخمينٍ بالقرب. و`IFCRELFILLSELEMENT` تقول
//     أيّ باب أو نافذة يملؤها.
//   - عرض الفتحة وارتفاعها من مقطعٍ مستطيل صريح، وموضعها إحداثيٌّ على
//     محور الجدار.
//   - الوحدة معلنة في `IFCUNITASSIGNMENT`.
//
// وقد قِيسَ على ملف العميل نفسه: ٢٦ جدارًا و٨ أبواب و٧ نوافذ. والأبواب
// والنوافذ **مطابقة تمامًا** لما استخرجه مسار DXF من الأقواس والزجاج
// (٨ و٧) — تأكيدٌ مستقلّ لصحّة ذلك المسار. وفرق الجدران (٢٦ مقابل ٢٩)
// لأن DXF يقطع الجدار عند كل فتحة فيصير قطعتين، وIFC يُبقيه جدارًا
// واحدًا وتُنسَب الفتحة إليه — وهو التوصيف المعماري الصحيح.
//
// وليس في هذا الملف `IFCSPACE`، فالغرف تبقى من الملء على قناعٍ مبنيّ
// من جدرانه. لكن ذلك القناع **مضبوط تمامًا**: جدرانٌ بمحاورها
// وسماكاتها وفتحاتٌ بمواضعها المعلنة، بلا عتبة ولا تزويج ولا تكميم.
//
// الصيغة STEP (ISO-10303-21): سطرٌ لكل كيان `#رقم=نوع(معاملات);`.
// والمعاملات: نصٌّ بين علامتَي اقتباس مفردة، وتعدادٌ بين نقطتين،
// ومرجعٌ بـ`#`، وقائمةٌ بين قوسين، و`$` للمعدوم، و`*` للمشتقّ.

/** قيمة معاملٍ في كيان IFC */
export type IfcValue =
  | { kind: "ref"; id: number }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "enum"; value: string }
  | { kind: "list"; items: IfcValue[] }
  /**
   * قيمة مُصنَّفة مكتوبة في موضعها لا ككيان مُرقَّم:
   * `IFCLINEINDEX((1,2,3,4))` و`IFCLABEL('مجلس')` و`IFCINTEGER(5)`.
   *
   * وهي صيغةٌ قياسية في STEP للأنواع المُعرَّفة وأنواع الاختيار،
   * وتَرِد فعلًا في ملفات حقيقية: في ملف العميل `IFCINDEXEDPOLYCURVE`
   * تحوي `IFCLINEINDEX(...)`، وفي مجموعات الخصائص `IFCLABEL` و
   * `IFCREAL`. وإغفالها لا يُفقِد قيمةً فقط بل **يُعلِّق القارئ**:
   * المؤشّر يتوقّف عند القوس الختامي فلا يتقدّم، فتدور الحلقة أبديًا
   * حتى ينفجر المصفوف.
   */
  | { kind: "typed"; type: string; value: IfcValue }
  /** `$` معدوم، أو `*` مشتقّ — كلاهما «لا قيمة هنا» */
  | { kind: "none" };

export interface IfcEntity {
  id: number;
  type: string;
  args: IfcValue[];
}

export interface IfcDocument {
  entities: Map<number, IfcEntity>;
  /** مخطط الملف من `FILE_SCHEMA` — `null` إن لم يُعلَن */
  schema: string | null;
}

const NONE: IfcValue = { kind: "none" };

/**
 * تفكيك قائمة معاملات إلى قيم.
 *
 * يُكتب يدويًا لا بتعبير نمطي: النصّ في STEP قد يحوي فاصلةً وقوسًا
 * (`'Wall (main), 184mm'`)، فالتقسيم بالفاصلة يشقّه نصفين. والاقتباس
 * المزدوَج `''` يعني علامةً واحدة داخل النصّ لا نهايته.
 */
export function parseArgs(source: string): IfcValue[] {
  const args: IfcValue[] = [];
  let i = 0;

  const skipSpace = (): void => {
    while (i < source.length && /\s/.test(source[i])) i += 1;
  };

  /** قراءة قيمة واحدة بدءًا من `i` */
  const readValue = (): IfcValue => {
    skipSpace();
    const ch = source[i];

    if (ch === "$" || ch === "*") {
      i += 1;
      return NONE;
    }

    if (ch === "#") {
      i += 1;
      const start = i;
      while (i < source.length && /[0-9]/.test(source[i])) i += 1;
      const id = Number(source.slice(start, i));
      return Number.isInteger(id) ? { kind: "ref", id } : NONE;
    }

    if (ch === "'") {
      i += 1;
      let out = "";
      while (i < source.length) {
        if (source[i] === "'") {
          // اقتباسان متتاليان = علامة واحدة داخل النصّ
          if (source[i + 1] === "'") {
            out += "'";
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        out += source[i];
        i += 1;
      }
      return { kind: "string", value: decodeStepString(out) };
    }

    if (ch === ".") {
      i += 1;
      const start = i;
      while (i < source.length && source[i] !== ".") i += 1;
      const value = source.slice(start, i);
      i += 1; // النقطة الختامية
      return { kind: "enum", value };
    }

    if (ch === "(") {
      i += 1;
      const items: IfcValue[] = [];
      for (;;) {
        skipSpace();
        if (i >= source.length) break;
        if (source[i] === ")") {
          i += 1;
          break;
        }
        if (source[i] === ",") {
          i += 1;
          continue;
        }
        items.push(readValue());
      }
      return { kind: "list", items };
    }

    // قيمة مُصنَّفة مكتوبة في موضعها: `IFCLABEL('x')`
    if (/[A-Za-z_]/.test(ch ?? "")) {
      const nameStart = i;
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i += 1;
      const type = source.slice(nameStart, i).toUpperCase();
      skipSpace();
      if (source[i] === "(") {
        // المحتوى يُقرأ كقائمة، وقيمةُ نوعٍ مُعرَّفٍ واحدةٌ في قائمة
        const inner = readValue();
        const single =
          inner.kind === "list" && inner.items.length === 1 ? inner.items[0] : inner;
        return { kind: "typed", type, value: single };
      }
      // مُعرِّفٌ بلا قوس: كلمةٌ لا نفهمها — تُهمَل ولا تُخترَع
      return NONE;
    }

    // رقم. والحدّ الأدنى تقدُّم خطوة واحدة: قارئٌ لا يتقدّم يدور أبديًا
    const start = i;
    while (i < source.length && !",)".includes(source[i])) i += 1;
    if (i === start) i += 1;
    const raw = source.slice(start, i).trim();
    const n = Number(raw);
    return Number.isFinite(n) && raw !== "" ? { kind: "number", value: n } : NONE;
  };

  for (;;) {
    skipSpace();
    if (i >= source.length) break;
    if (source[i] === ",") {
      i += 1;
      continue;
    }
    args.push(readValue());
  }

  return args;
}

/**
 * فكّ ترميز STEP للنصّ.
 *
 * STEP يُرمّز الحروف غير اللاتينية بـ`\X2\....\X0\` بوحدات UTF-16
 * سُدسيّة. وأسماء الغرف العربية تأتي بهذا الترميز، فتركُه يعرض
 * «‎\X2\0645062C06440633\X0\» للعميل بدل «مجلس».
 */
export function decodeStepString(value: string): string {
  return value
    .replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, (_, hex: string) => {
      let out = "";
      for (let k = 0; k + 3 < hex.length; k += 4) {
        out += String.fromCharCode(parseInt(hex.slice(k, k + 4), 16));
      }
      return out;
    })
    .replace(/\\X\\([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\S\\(.)/g, (_, c: string) => String.fromCharCode(c.charCodeAt(0) + 128));
}

/**
 * قراءة مستند IFC.
 *
 * لا يرمي على كيانٍ مشوّه: يُهمله ويُكمل. الملفات تأتي من مُصدِّرات
 * مختلفة وفيها كياناتٌ لا تعنينا، ورفض الملف كلّه لأجل سطرٍ واحد
 * يرفض مبنًى صحيحًا. والكيان المجهول يُهمَل بصمت — لا يُخترَع.
 */
export function parseIfc(text: string): IfcDocument {
  const entities = new Map<number, IfcEntity>();

  const schemaMatch = /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/.exec(text);
  const schema = schemaMatch ? schemaMatch[1] : null;

  // الكيانات كلّها في قسم DATA؛ ما قبله ترويسة لا كيانات فيها
  const dataStart = text.indexOf("DATA;");
  const body = dataStart >= 0 ? text.slice(dataStart + 5) : text;

  // ‎`#N = TYPE ( ... ) ;` — والفاصلة المنقوطة قد تقع داخل نصّ، فنعتمد
  // على أن كل كيان يبدأ بـ`#` في أول سطره بعد التطبيع.
  const pattern = /#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(/g;

  for (;;) {
    const match = pattern.exec(body);
    if (!match) break;

    const id = Number(match[1]);
    const type = match[2].toUpperCase();

    // إيجاد القوس المُطابِق، مع تخطّي ما بين علامات الاقتباس
    let depth = 1;
    let j = match.index + match[0].length;
    let inString = false;
    while (j < body.length && depth > 0) {
      const ch = body[j];
      if (inString) {
        if (ch === "'") inString = body[j + 1] === "'" ? (j += 1, true) : false;
      } else if (ch === "'") {
        inString = true;
      } else if (ch === "(") {
        depth += 1;
      } else if (ch === ")") {
        depth -= 1;
      }
      j += 1;
    }

    // كيانٌ مقطوع في نهاية ملف مشوّه — يُهمَل ولا يُخمَّن
    if (depth !== 0) break;

    entities.set(id, {
      id,
      type,
      args: parseArgs(body.slice(match.index + match[0].length, j - 1)),
    });

    pattern.lastIndex = j;
  }

  return { entities, schema };
}

// ============================================================
// وصولٌ آمن للمعاملات
// ============================================================
// الترتيب في IFC ثابت بالمواصفة، لكن المُصدِّرات تُسقط الاختيارية
// وتكتب `$`. فكل قارئ يُعيد `null` عند الغياب ولا يفترض صفرًا: صفرٌ
// مكان سماكة مجهولة يعطي جدارًا بلا سماكة، وصفرٌ مكان ارتفاع يعطي
// مساحة دهان صفرًا — وكلاهما فسادٌ صامت.

export function argAt(entity: IfcEntity | undefined, index: number): IfcValue | null {
  return entity?.args[index] ?? null;
}

export function refAt(entity: IfcEntity | undefined, index: number): number | null {
  const value = argAt(entity, index);
  return value?.kind === "ref" ? value.id : null;
}

export function numberAt(entity: IfcEntity | undefined, index: number): number | null {
  const value = argAt(entity, index);
  return value?.kind === "number" ? value.value : null;
}

export function stringAt(entity: IfcEntity | undefined, index: number): string | null {
  const value = argAt(entity, index);
  return value?.kind === "string" && value.value.trim() !== "" ? value.value : null;
}

export function enumAt(entity: IfcEntity | undefined, index: number): string | null {
  const value = argAt(entity, index);
  return value?.kind === "enum" ? value.value : null;
}

export function listAt(entity: IfcEntity | undefined, index: number): IfcValue[] {
  const value = argAt(entity, index);
  return value?.kind === "list" ? value.items : [];
}

/** مراجع قائمةٍ في موضع — تتخطّى ما ليس مرجعًا */
export function refsAt(entity: IfcEntity | undefined, index: number): number[] {
  return listAt(entity, index)
    .filter((item): item is { kind: "ref"; id: number } => item.kind === "ref")
    .map((item) => item.id);
}

/** أرقام قائمةٍ في موضع — لإحداثيات النقطة والاتجاه */
export function numbersAt(entity: IfcEntity | undefined, index: number): number[] {
  return listAt(entity, index)
    .filter((item): item is { kind: "number"; value: number } => item.kind === "number")
    .map((item) => item.value);
}

/** كل كيانات نوعٍ ما، مرتّبةً بالمُعرَّف لثبات الترتيب */
export function entitiesOfType(doc: IfcDocument, ...types: string[]): IfcEntity[] {
  const wanted = new Set(types.map((type) => type.toUpperCase()));
  return [...doc.entities.values()]
    .filter((entity) => wanted.has(entity.type))
    .sort((a, b) => a.id - b.id);
}

// ============================================================
// الوحدة
// ============================================================

/** بادئات SI المستخدمة في البناء */
const PREFIX_FACTOR: Record<string, number> = {
  MILLI: 1e-3,
  CENTI: 1e-2,
  DECI: 1e-1,
  DECA: 10,
  HECTO: 100,
  KILO: 1000,
  MICRO: 1e-6,
};

/**
 * معامل التحويل إلى المتر من `IFCUNITASSIGNMENT`.
 *
 * يُعيد `null` عند غياب وحدة الطول أو كونها غير مترية: ملفٌ
 * بالمليمتر يُقرأ بالمتر يعطي بيتًا طوله ١٢ ألف متر، وكل كمية بعده
 * فاسدة صامتةً. فالافتراض ممنوع.
 */
export function ifcLengthToMeters(doc: IfcDocument): number | null {
  for (const assignment of entitiesOfType(doc, "IFCUNITASSIGNMENT")) {
    for (const id of refsAt(assignment, 0)) {
      const unit = doc.entities.get(id);
      if (!unit) continue;

      // الوحدة المُشتقّة بمعامل تحويل (قدم/إنش) — تُقرأ من مقياسها
      if (unit.type === "IFCCONVERSIONBASEDUNIT" && enumAt(unit, 1) === "LENGTHUNIT") {
        const factorId = refAt(unit, 3);
        const factor = factorId === null ? undefined : doc.entities.get(factorId);
        // `IFCMEASUREWITHUNIT(ValueComponent, UnitComponent)`
        const value = numberAt(factor, 0);
        if (value !== null && value > 0) {
          const baseId = refAt(factor, 1);
          const base = baseId === null ? undefined : doc.entities.get(baseId);
          const baseFactor = base ? siLengthFactor(base) : null;
          if (baseFactor !== null) return value * baseFactor;
        }
        continue;
      }

      if (unit.type !== "IFCSIUNIT") continue;
      if (enumAt(unit, 1) !== "LENGTHUNIT") continue;
      const factor = siLengthFactor(unit);
      if (factor !== null) return factor;
    }
  }

  return null;
}

/** معامل وحدة طول SI واحدة، أو `null` إن لم تكن طولًا مِتريًا */
function siLengthFactor(unit: IfcEntity): number | null {
  if (unit.type !== "IFCSIUNIT") return null;
  if (enumAt(unit, 3) !== "METRE") return null;
  const prefix = enumAt(unit, 2);
  if (prefix === null) return 1;
  return PREFIX_FACTOR[prefix] ?? null;
}
