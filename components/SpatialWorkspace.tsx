"use client";
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Brand } from "./Header";
import Icon from "./ui/Icon";
import Sheet from "./ui/Sheet";
import PlanMap from "./PlanMap";
import { demoAnalysis, demoDesign } from "@/lib/demo-home";
import { designStyles } from "@/lib/styles";
import { rememberProject } from "@/lib/client/projects";
import type { CameraCommand, WalkInput } from "./SceneNavigation";
const Model = dynamic(() => import("./RealHouse3D"), {
  ssr: false,
  loading: () => (
    <div className="bt-model-loading">
      <div className="bt-loading-mark">
        <Icon name="cube" />
      </div>
      <h2>منزلك بدأ يأخذ شكله…</h2>
    </div>
  ),
});
const EMPTY: any[] = [];
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="bt-empty bt-scene-error">
        <Icon name="cube" />
        <h2>تعذر تشغيل العرض ثلاثي الأبعاد</h2>
        <p>جرّب تحديث الصفحة أو فتحها في متصفح يدعم عرض 3D.</p>
        <button className="bt-button" onClick={() => window.location.reload()}>
          حاول مرة أخرى
        </button>
        <Link href="/dashboard">العودة إلى مشاريعي</Link>
      </div>
    ) : (
      this.props.children
    );
  }
}
function value(n: any, unit: string) {
  return typeof n === "number" && Number.isFinite(n)
    ? `${n.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ${unit}`
    : null;
}
function ItemDetails({ item, onClose }: { item: any; onClose: () => void }) {
  const details = [
    ["الخامة", item.material],
    ["اللون", item.color && !item.color.startsWith("#") ? item.color : null],
    ["الطول", value(item.lengthM, "م")],
    ["العرض", value(item.widthM, "م")],
    ["العمق", value(item.depthM, "م")],
    ["الارتفاع", value(item.heightM, "م")],
    ["السماكة", value(item.thicknessM, "م")],
    ["المساحة", value(item.areaM2, "م²")],
  ].filter(([, v]) => v);
  return (
    <div className="bt-item-card" aria-label="تفاصيل العنصر">
      <button
        className="bt-icon bt-item-close"
        aria-label="إغلاق تفاصيل العنصر"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      <div className="bt-item-top">
        <span
          className="bt-material-swatch"
          style={{
            background: item.color?.startsWith("#") ? item.color : undefined,
          }}
        >
          <Icon
            name={
              item.type === "wall"
                ? "layers"
                : item.type === "floor"
                  ? "home"
                  : "cube"
            }
          />
        </span>
        <div>
          <small>
            {item.room ||
              (
                {
                  wall: "الجدران",
                  floor: "الأرضيات",
                  door: "الأبواب",
                  window: "النوافذ",
                } as any
              )[item.type] ||
              "من تفاصيل منزلك"}
          </small>
          <h2>{item.name || "عنصر من المنزل"}</h2>
        </div>
      </div>
      <dl>
        {details.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {item.details && <p>{item.details}</p>}
      <div className="bt-item-price">
        <span>السعر</span>
        <b>
          {typeof item.price === "number"
            ? value(item.price, "ر.س")
            : "لم يتوفر بعد"}
        </b>
      </div>
      {item.type === "wall" && item.lengthM && (
        <small>
          مساحة الجدار الإجمالية {value(item.lengthM * item.heightM, "م²")} قبل
          خصم الفتحات. كمية الدهان تعتمد على المنتج وعدد الطبقات.
        </small>
      )}
    </div>
  );
}
export default function SpatialWorkspace({
  id,
  walk = false,
  initialShopping = false,
}: {
  id: string;
  walk?: boolean;
  initialShopping?: boolean;
}) {
  const demo = id === "demo";
  const [analysis, setAnalysis] = useState<any>(demo ? demoAnalysis : null),
    [design, setDesign] = useState<any>(demo ? demoDesign : null),
    [doors, setDoors] = useState<any[]>(EMPTY),
    [upload, setUpload] = useState<any>(
      demo ? { id: "demo", name: "المنزل التجريبي" } : null,
    ),
    [health, setHealth] = useState<any>(null),
    [loading, setLoading] = useState(!demo),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null),
    [activeRoom, setActiveRoom] = useState(walk ? 0 : -1),
    [drawer, setDrawer] = useState<
      "design" | "shopping" | "share" | "help" | null
    >(initialShopping ? "shopping" : null),
    [style, setStyle] = useState("Saudi Contemporary"),
    [busy, setBusy] = useState(false),
    [before, setBefore] = useState(false),
    [night, setNight] = useState(false),
    [view, setView] = useState<"2d" | "3d">("3d"),
    [command, setCommand] = useState<CameraCommand>({ type: "reset", seq: 0 }),
    [started, setStarted] = useState(!walk),
    [autoplay, setAutoplay] = useState(false),
    [lookToWalk, setLookToWalk] = useState(false),
    [input, setInput] = useState<WalkInput>({ x: 0, y: 0 }),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState(false),
    [reduced, setReduced] = useState(false),
    [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setShareUrl(
      window.location.origin +
        "/project/" +
        id +
        (walk ? "/walk" : demo ? "" : "/3d"),
    );
    const chosen = new URLSearchParams(window.location.search).get("style");
    if (designStyles.some((s) => s.id === chosen)) setStyle(chosen!);
  }, [id, walk]);
  useEffect(() => {
    if (demo) return;
    let live = true;
    Promise.all([
      fetch("/api/uploads/" + id).then((r) => r.json()),
      fetch("/api/uploads/" + id + "/analysis").then((r) => r.json()),
      fetch("/api/uploads/" + id + "/design").then((r) => r.json()),
      fetch("/api/uploads/" + id + "/doors").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ])
      .then(([u, a, d, ds, h]) => {
        if (!live) return;
        if (u.ok) {
          setUpload(u.upload);
          rememberProject(u.upload);
        }
        if (a.ok) setAnalysis(a.analysis);
        if (d.ok) {
          setDesign(d.design);
          if (designStyles.some((s) => s.id === d.design?.design?.style))
            setStyle(d.design.design.style);
        }
        setDoors(ds.doors?.doors || EMPTY);
        setHealth(h);
      })
      .catch(() => {
        if (live) setError("تعذر فتح المنزل. تحقق من اتصالك وحاول مرة أخرى.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, demo]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (drawer || selected) {
      setInput({ x: 0, y: 0 });
      setAutoplay(false);
    }
  }, [drawer, selected]);
  useEffect(() => {
    const stop = () => {
      setAutoplay(false);
      setInput({ x: 0, y: 0 });
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);
  const rooms = analysis?.inferredRooms || EMPTY;
  const roomName =
    activeRoom >= 0
      ? rooms[activeRoom]?.name || "غرفة " + (activeRoom + 1)
      : "منزلي";
  const items = useMemo(
    () => [
      ...(design?.design?.items || EMPTY),
      ...(design?.design?.lighting || EMPTY),
      ...(design?.design?.airConditioning || EMPTY),
    ],
    [design],
  );
  const emptyDesign = useMemo(
    () => ({
      design: { items: EMPTY, lighting: EMPTY, airConditioning: EMPTY },
    }),
    [],
  );
  async function designRoom() {
    if (busy) return;
    if (demo) {
      setNotice("ارفع مخططك لتصميم منزلك. هذا المنزل مخصص لاستكشاف التجربة.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/design", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uploadId: id,
          style,
          room: activeRoom >= 0 ? roomName : undefined,
          roomIndex: activeRoom >= 0 ? activeRoom : undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(
          "تعذر إكمال التصميم الآن. تصميمك السابق محفوظ، ويمكنك المحاولة مرة أخرى.",
        );
      setDesign(body);
      setBefore(false);
      setDrawer(null);
      setNotice("حُفظ التصميم. استكشف التفاصيل داخل منزلك.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إكمال التصميم.");
    } finally {
      setBusy(false);
    }
  }
  function moveRoom(n: number) {
    setSelected(null);
    setActiveRoom(n);
  }
  function cameraAction(type: CameraCommand["type"]) {
    setCommand((c) => ({ type, seq: c.seq + 1 }));
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setNotice("يمكنك تحديد الرابط ونسخه يدويًا.");
    }
  }
  const modelUrl = demo ? "/project/demo" : "/project/" + id + "/3d";
  if (loading)
    return (
      <main className="bt-model-loading">
        <div className="bt-loading-mark">
          <Icon name="cube" />
        </div>
        <h1>نجهّز منزلك…</h1>
        <p>مساحة لتعيش التفاصيل.</p>
      </main>
    );
  if (!analysis?.ifcPlan?.walls?.length)
    return (
      <main className="bt-empty">
        <Icon name="home" />
        <h1>{error ? "تعذر فتح المنزل" : "منزلك لم يكتمل بعد"}</h1>
        <p>{error || "أكمل قراءة المخطط لتظهر المساحات ثلاثية الأبعاد."}</p>
        <Link href={"/project/" + id} className="bt-button">
          العودة إلى المخطط <Icon name="arrow" />
        </Link>
      </main>
    );
  return (
    <main
      className={
        "bt-spatial " +
        (walk ? "is-walk" : "") +
        (autoplay ? " is-cinema" : "") +
        (night ? " is-night" : "")
      }
    >
      <div className="bt-spatial-canvas">
        <SceneBoundary>
          {view === "2d" && !walk ? (
            <PlanMap analysis={analysis} />
          ) : (
            <Model
              analysis={analysis}
              design={before ? emptyDesign : design || emptyDesign}
              detectedDoors={doors}
              mode={walk ? "tour" : "overview"}
              autoplay={started && autoplay}
              onSelect={setSelected}
              activeRoom={activeRoom}
              onRoomChange={moveRoom}
              onNotice={setNotice}
              command={command}
              walkInput={started ? input : undefined}
              lookToWalk={started && lookToWalk}
              night={night}
            />
          )}
        </SceneBoundary>
      </div>
      <header className="bt-spatial-header">
        <div className="bt-spatial-identity">
          <Brand />
          <i />
          <span>
            {upload?.name || "منزلي"}
            {demo && <small>تجربة توضيحية</small>}
          </span>
        </div>
        <div className="bt-save-status">
          <Icon name={design ? "check" : "folder"} />
          <span>
            {demo
              ? "منزل تجريبي"
              : busy
                ? "نصمم مساحتك…"
                : design
                  ? "التصميم محفوظ"
                  : "المخطط محفوظ"}
          </span>
        </div>
        <div className="bt-spatial-actions">
          {walk ? (
            <Link className="bt-button secondary" href={modelUrl}>
              الخروج من الجولة <Icon name="close" />
            </Link>
          ) : (
            <>
              <button
                className="bt-icon"
                onClick={() => setDrawer("help")}
                aria-label="طريقة التحكم"
              >
                <Icon name="info" />
              </button>
              <button
                className="bt-button secondary"
                onClick={() => {
                  setCopied(false);
                  setDrawer("share");
                }}
              >
                <Icon name="share" />
                <span>مشاركة</span>
              </button>
            </>
          )}
        </div>
      </header>
      {!walk && (
        <>
          <div
            className="bt-view-switch"
            role="group"
            aria-label="طريقة عرض المنزل"
          >
            <button aria-pressed={view === "2d"} onClick={() => setView("2d")}>
              2D
            </button>
            <button aria-pressed={view === "3d"} onClick={() => setView("3d")}>
              3D
            </button>
            <Link href={"/project/" + id + "/walk"}>
              Walk <Icon name="walk" />
            </Link>
          </div>
          <div className="bt-scene-side">
            <button
              className="bt-icon"
              aria-label="إعادة ضبط الكاميرا"
              onClick={() => cameraAction("reset")}
            >
              <Icon name="reset" />
            </button>
            <button
              className="bt-icon"
              aria-label="تقريب"
              onClick={() => cameraAction("in")}
              disabled={view === "2d"}
            >
              <Icon name="plus" />
            </button>
            <button
              className="bt-icon"
              aria-label="إبعاد"
              onClick={() => cameraAction("out")}
              disabled={view === "2d"}
            >
              <Icon name="minus" />
            </button>
          </div>
          <div className="bt-scene-options">
            <button
              className="bt-button secondary"
              aria-pressed={night}
              onClick={() => setNight((v) => !v)}
            >
              <Icon name="sun" />
              {night ? "إضاءة ليلية" : "ضوء النهار"}
            </button>
            {items.length > 0 && (
              <button
                className="bt-button secondary"
                aria-pressed={before}
                onClick={() => setBefore((v) => !v)}
              >
                <Icon name="layers" />
                {before ? "بعد التصميم" : "قبل التصميم"}
              </button>
            )}
          </div>
        </>
      )}
      {selected && started && (
        <ItemDetails item={selected} onClose={() => setSelected(null)} />
      )}
      {!walk && (
        <>
          <div className="bt-room-dock">
            <div className="bt-room-list" aria-label="غرف المنزل">
              {rooms.map((room: any, i: number) => (
                <button
                  aria-pressed={activeRoom === i}
                  key={room.id || i}
                  onClick={() => moveRoom(i)}
                >
                  <span className="bt-room-preview">
                    <Icon name="home" />
                  </span>
                  <span>
                    {room.name || "غرفة " + (i + 1)}
                    <small>{value(Number(room.areaM2), "م²")}</small>
                  </span>
                </button>
              ))}
            </div>
            <button
              className="bt-button"
              onClick={() => {
                setError("");
                setDrawer("design");
              }}
            >
              <Icon name="spark" />
              {activeRoom >= 0 ? "صمم هذه الغرفة" : "صمم منزلي"}
            </button>
          </div>
          <button
            className="bt-shopping-button bt-button secondary"
            onClick={() => setDrawer("shopping")}
          >
            <Icon name="bag" />
            <span>مشتريات المنزل</span>
            {items.length > 0 && <b>{items.length}</b>}
          </button>
          <Link className="bt-enter-home" href={"/project/" + id + "/walk"}>
            ادخل منزلك <Icon name="arrow" />
          </Link>
        </>
      )}
      {walk && !started && (
        <div className="bt-walk-welcome">
          <span className="bt-eyebrow">لحظتك الأولى في الداخل</span>
          <h1>
            مرحبًا بك
            <br />
            في منزلك
          </h1>
          <p>اكتشف المساحات. عش التفاصيل.</p>
          <button className="bt-button" onClick={() => setStarted(true)}>
            ابدأ الجولة <Icon name="arrow" />
          </button>
          <small>اسحب للنظر حولك، واضغط على العناصر لمعرفة تفاصيلها.</small>
        </div>
      )}
      {walk && started && (
        <>
          <div className="bt-walk-room">
            <label htmlFor="walk-room">اذهب إلى</label>
            <select
              id="walk-room"
              value={activeRoom}
              onChange={(e) => moveRoom(Number(e.target.value))}
            >
              {rooms.length ? (
                rooms.map((r: any, i: number) => (
                  <option key={r.id || i} value={i}>
                    {r.name || "غرفة " + (i + 1)}
                  </option>
                ))
              ) : (
                <option value={0}>المساحة الرئيسية</option>
              )}
            </select>
            <Icon name="chevron" />
          </div>
          <div className="bt-walk-bottom">
            <div className="bt-cinema-bar">
              <button
                className="bt-icon"
                aria-label={
                  autoplay ? "إيقاف الجولة مؤقتًا" : "بدء جولة سينمائية"
                }
                aria-pressed={autoplay}
                onClick={() => {
                  if (reduced) {
                    setNotice(
                      "الحركة التلقائية متوقفة حسب إعداد تقليل الحركة في جهازك. يمكنك التنقل يدويًا.",
                    );
                    return;
                  }
                  setAutoplay((v) => !v);
                }}
              >
                <Icon name={autoplay ? "pause" : "play"} />
              </button>
              <span>جولة سينمائية</span>
              <i />
              <b>{rooms.length ? roomName : "منزلي"}</b>
              <button
                className="bt-icon"
                aria-label="الغرفة التالية"
                disabled={rooms.length < 2}
                onClick={() => moveRoom((activeRoom + 1) % rooms.length)}
              >
                <Icon name="arrow" />
              </button>
            </div>
            <div className="bt-walk-extras">
              <button
                onClick={() => setDrawer("shopping")}
                aria-label="مشتريات المنزل"
                className="bt-icon"
              >
                <Icon name="bag" />
              </button>
              <button
                className="bt-icon"
                aria-label="إرشادات المشي"
                onClick={() => setDrawer("help")}
              >
                <Icon name="info" />
              </button>
              <button
                className="bt-look-control"
                aria-pressed={lookToWalk}
                onClick={() => setLookToWalk((v) => !v)}
                disabled={reduced}
              >
                المشي بالنظر <span className={lookToWalk ? "on" : ""} />
              </button>
            </div>
          </div>
          <div className="bt-joystick" role="group" aria-label="التحكم بالمشي">
            {[
              { x: 0, y: 1, label: "إلى الأمام", c: "up", symbol: "↑" },
              { x: -1, y: 0, label: "إلى اليسار", c: "left", symbol: "←" },
              { x: 1, y: 0, label: "إلى اليمين", c: "right", symbol: "→" },
              { x: 0, y: -1, label: "إلى الخلف", c: "down", symbol: "↓" },
            ].map((d) => (
              <button
                className={d.c}
                key={d.c}
                aria-label={d.label}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setAutoplay(false);
                  setInput({ x: d.x, y: d.y });
                }}
                onPointerUp={() => setInput({ x: 0, y: 0 })}
                onPointerCancel={() => setInput({ x: 0, y: 0 })}
                onLostPointerCapture={() => setInput({ x: 0, y: 0 })}
              >
                {d.symbol}
              </button>
            ))}
            <span />
          </div>
          <p className="bt-walk-hint">
            اسحب للنظر · WASD أو الأسهم للمشي · اضغط للتفاصيل
          </p>
        </>
      )}
      {notice && (
        <div className="bt-toast" role="status">
          {notice}
          <button
            className="bt-icon"
            onClick={() => setNotice("")}
            aria-label="إغلاق التنبيه"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      {drawer && (
        <Sheet
          title={
            drawer === "design"
              ? activeRoom >= 0
                ? "تصميم " + roomName
                : "تصميم منزلي"
              : drawer === "shopping"
                ? "مشتريات المنزل"
                : drawer === "share"
                  ? "شارك منزلك"
                  : "استكشف براحتك"
          }
          onClose={() => {
            if (!busy) setDrawer(null);
          }}
          wide={drawer === "shopping"}
        >
          {drawer === "design" ? (
            <>
              <p className="bt-muted">اختر الإحساس الذي تريده لمساحتك.</p>
              <div className="bt-design-styles">
                {designStyles.map((s) => (
                  <button
                    className={style === s.id ? "selected" : ""}
                    aria-pressed={style === s.id}
                    disabled={busy}
                    onClick={() => setStyle(s.id)}
                    key={s.id}
                  >
                    <span
                      className="bt-style-photo"
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url(${s.image})`,
                        backgroundPosition: s.position,
                        backgroundSize: s.size,
                      }}
                    />
                    <span>
                      {s.name}
                      <small dir="ltr">{s.id}</small>
                    </span>
                    {style === s.id && <Icon name="check" />}
                  </button>
                ))}
              </div>
              <p className="bt-muted">
                {demo
                  ? "ارفع مخططك لتطبيق التصميم على منزلك."
                  : "تصميم مقترح للأثاث والخامات؛ تبقى جدران منزلك وأبعاده كما هي."}
              </p>
              {error && (
                <p className="bt-error" role="alert">
                  {error}
                </p>
              )}
              {demo ? (
                <Link className="bt-button wide" href="/upload">
                  ابدأ بمخططك <Icon name="arrow" />
                </Link>
              ) : (
                <button
                  className="bt-button wide"
                  onClick={designRoom}
                  disabled={busy || health?.openaiConfigured === false}
                >
                  <Icon name="spark" />
                  {busy ? "نختار التفاصيل التي تناسبك…" : "صمم لي"}
                </button>
              )}
              {health?.openaiConfigured === false && !demo && (
                <p className="bt-muted">
                  خدمة التصميم غير متاحة حاليًا. يمكنك استكشاف النموذج ومراجعة
                  مساحاته.
                </p>
              )}
            </>
          ) : drawer === "shopping" ? (
            <>
              <p className="bt-muted">
                {demo
                  ? "عناصر توضيحية من المنزل التجريبي."
                  : "عناصر تصميمك، مرتبة حسب الغرف."}{" "}
                الأسعار والمتاجر تظهر عند ربط منتجات فعلية.
              </p>
              {items.length ? (
                <div className="bt-shopping-rooms">
                  {Array.from(
                    new Set(items.map((i: any) => String(i.room || "المنزل"))),
                  ).map((room) => (
                    <details open key={room}>
                      <summary>
                        <Icon name="home" />
                        <b>{room}</b>
                        <span>
                          {
                            items.filter(
                              (i: any) => (i.room || "المنزل") === room,
                            ).length
                          }{" "}
                          عناصر
                        </span>
                      </summary>
                      {items
                        .filter((i: any) => (i.room || "المنزل") === room)
                        .map((item: any, i: number) => (
                          <button
                            className="bt-shopping-item"
                            key={i}
                            onClick={() => {
                              setSelected(item);
                              setDrawer(null);
                            }}
                          >
                            <span
                              className="bt-small-swatch"
                              style={{
                                background: item.color?.startsWith("#")
                                  ? item.color
                                  : undefined,
                              }}
                            />
                            <span>
                              <b>{item.name}</b>
                              <small>{item.material}</small>
                            </span>
                            <span>غير مسعّر</span>
                            <Icon name="chevron" />
                          </button>
                        ))}
                    </details>
                  ))}
                </div>
              ) : (
                <div className="bt-empty compact">
                  <Icon name="bag" />
                  <h3>تفاصيل منزلك تبدأ بالتصميم</h3>
                  <p>صمم غرفتك لتظهر قائمة الأثاث والتشطيبات هنا.</p>
                  <button
                    className="bt-button"
                    onClick={() => setDrawer("design")}
                  >
                    اختر التصميم
                  </button>
                </div>
              )}
              <div className="bt-shopping-total">
                <span>التكلفة الإجمالية</span>
                <b>غير متاحة بعد</b>
              </div>
            </>
          ) : drawer === "share" ? (
            <>
              <p>انسخ رابط المشروع للعودة إليه أو مشاركته.</p>
              <label className="bt-share-field">
                رابط المنزل
                <input
                  readOnly
                  dir="ltr"
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button className="bt-button wide" onClick={copyLink}>
                <Icon name={copied ? "check" : "share"} />
                {copied ? "تم نسخ الرابط" : "نسخ الرابط"}
              </button>
              <p className="bt-muted">
                يمكن لمن يملك الرابط فتح المشروع؛ لا توجد صلاحيات مشاركة خاصة في
                النسخة الحالية.
              </p>
            </>
          ) : (
            <div className="bt-help">
              <p>
                <Icon name="compass" />
                <span>
                  في 3D: اسحب لتدوير المنزل، واستخدم إصبعين أو عجلة الماوس
                  للتقريب.
                </span>
              </p>
              <p>
                <Icon name="walk" />
                <span>
                  داخل المنزل: اسحب للنظر حولك. اضغط المشهد، ثم استخدم WASD أو
                  الأسهم للحركة، أو أزرار اللمس على الجوال.
                </span>
              </p>
              <p>
                <Icon name="home" />
                <span>
                  اختر غرفة للانتقال إليها عبر الفتحات المتصلة. إذا لم يوجد
                  مسار، راجع المخطط.
                </span>
              </p>
              <p>
                <Icon name="play" />
                <span>
                  الجولة السينمائية تمر بالغرف المتصلة. يمكنك إيقافها في أي وقت.
                </span>
              </p>
            </div>
          )}
        </Sheet>
      )}
    </main>
  );
}
