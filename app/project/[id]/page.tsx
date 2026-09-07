"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import PlanReading from "@/components/PlanReading";
import PlanPreview from "@/components/PlanPreview";
import PlanMap from "@/components/PlanMap";
import Icon from "@/components/ui/Icon";
import { rememberProject } from "@/lib/client/projects";
export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const [upload, setUpload] = useState<any>(null),
    [analysis, setAnalysis] = useState<any>(null),
    [rooms, setRooms] = useState<any[]>([]),
    [doors, setDoors] = useState<any[]>([]),
    [health, setHealth] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [readingNames, setReadingNames] = useState(false),
    [styleQuery, setStyleQuery] = useState("");
  useEffect(() => {
    const chosen = new URLSearchParams(window.location.search).get("style");
    if (chosen) setStyleQuery("?style=" + encodeURIComponent(chosen));
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([
      fetch("/api/uploads/" + id).then((r) => r.json()),
      fetch("/api/uploads/" + id + "/analysis").then((r) => r.json()),
      fetch("/api/uploads/" + id + "/rooms").then((r) => r.json()),
      fetch("/api/uploads/" + id + "/doors").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ])
      .then(([u, a, rs, ds, h]) => {
        if (!live) return;
        if (u.ok) {
          setUpload(u.upload);
          rememberProject(u.upload);
        } else setError("لم نعثر على هذا المشروع.");
        if (a.ok) setAnalysis(a.analysis);
        setRooms(rs.rooms?.rooms || []);
        setDoors(ds.doors?.doors || []);
        setHealth(h);
      })
      .catch(() => {
        if (live)
          setError("تعذر فتح المشروع. تحقق من الاتصال ثم حاول مرة أخرى.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id]);
  async function analyze() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fetch("/api/bimy/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: id }),
      });
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: id }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(
          "تعذر إكمال قراءة المخطط. حاول مرة أخرى أو ارفع نسخة أوضح.",
        );
      setAnalysis(body.result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "تعذر فهم هذا الجزء من المخطط.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function readNames() {
    setReadingNames(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: id }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(
          "تعذر التعرف على أسماء الغرف الآن. يمكنك متابعة استكشاف المساحات.",
        );
      setRooms(body.rooms || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر قراءة أسماء الغرف.");
    } finally {
      setReadingNames(false);
    }
  }
  const wallCount =
    analysis?.ifcPlan?.walls?.length || analysis?.scanCounts?.walls || 0;
  const openings = analysis?.ifcPlan?.openings || [];
  const ready = Boolean(analysis?.ifcPlan?.walls?.length);
  const image = ["png", "jpg", "jpeg", "webp"].includes(upload?.extension);
  const resultCounts = [
    ["غرف", rooms.length || analysis?.inferredRooms?.length || 0],
    ["جدران", wallCount],
    [
      "أبواب",
      Math.max(
        doors.length,
        openings.filter((o: any) => o.kind === "door").length,
      ),
    ],
    [
      "نوافذ",
      openings.filter((o: any) => o.kind === "window").length ||
        analysis?.scanCounts?.windows ||
        0,
    ],
  ];
  return (
    <div className="bt-app">
      <Header />
      <main id="main-content" className="bt-review">
        <div className="bt-review-top">
          <Link href="/dashboard" className="bt-text-link">
            مشاريعي
          </Link>
          <span>/</span>
          <b>{upload?.name || "مخطط منزلك"}</b>
          <Link href="/upload" className="bt-text-link bt-push">
            مخطط جديد <Icon name="plus" />
          </Link>
        </div>
        <div className="bt-page-title">
          <span className="bt-eyebrow">المساحات تبدأ بالوضوح</span>
          <h1>{ready ? "أهلًا بملامح منزلك." : "كل التفاصيل تبدأ هنا."}</h1>
          <p>
            {ready
              ? "راجع المخطط، ثم شاهد منزلك من بُعد جديد."
              : "مخططك أمامك. لنكتشف ما وراء الخطوط."}
          </p>
        </div>
        <ol className="bt-progress" aria-label="مراحل المشروع">
          <li className={ready ? "done" : "active"}>
            <span>{ready ? <Icon name="check" /> : "1"}</span>فهم المخطط
          </li>
          <li className={ready ? "active" : ""}>
            <span>2</span>مراجعة
          </li>
          <li>
            <span>3</span>منزلي 3D
          </li>
        </ol>
        {loading ? (
          <div className="bt-empty" role="status">
            <div className="bt-loading-mark">
              <Icon name="home" />
            </div>
            <h2>نستعيد مخططك…</h2>
          </div>
        ) : !upload ? (
          <div className="bt-empty">
            <h2>{error || "المشروع غير موجود"}</h2>
            <Link className="bt-button" href="/upload">
              ابدأ بمخطط جديد
            </Link>
          </div>
        ) : (
          <>
            <div className="bt-review-workspace">
              <div
                className={"bt-review-canvas " + (busy ? "is-analyzing" : "")}
              >
                {analysis && image ? (
                  <PlanReading
                    imageUrl={"/api/uploads/" + id + "/file"}
                    analysis={analysis}
                    rooms={rooms}
                    uploadId={id}
                  />
                ) : ready ? (
                  <PlanMap analysis={analysis} />
                ) : (
                  <PlanPreview
                    url={"/api/uploads/" + id + "/file"}
                    extension={upload.extension}
                    name={upload.name}
                  />
                )}
                {busy && (
                  <div className="bt-analysis-story" role="status">
                    <div className="bt-loading-mark">
                      <Icon name="layers" />
                    </div>
                    <h2>نقرأ مخططك…</h2>
                    <p>
                      نبحث عن الجدران والفتحات والمساحات.
                      <br />
                      ستظهر التفاصيل بعد اكتمال القراءة.
                    </p>
                  </div>
                )}
              </div>
              <aside className="bt-review-summary">
                <span className="bt-eyebrow">مخططك، ببساطة</span>
                <h2>
                  {busy
                    ? "نتعرف على منزلك"
                    : ready
                      ? "منزلك بدأ يأخذ شكله"
                      : "جاهز للتحليل"}
                </h2>
                {analysis ? (
                  <div className="bt-counts">
                    {resultCounts.map(([name, n]) => (
                      <div key={String(name)}>
                        <b>{n}</b>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>نحوّل خطوط مخططك إلى مساحات يمكنك استكشافها.</p>
                )}
                {error && (
                  <p className="bt-error" role="alert">
                    {error}
                  </p>
                )}
                {ready ? (
                  <>
                    <p className="bt-muted">
                      اضغط على عناصر المخطط لاستعراض تفاصيلها.
                    </p>
                    <Link
                      href={"/project/" + id + "/3d" + styleQuery}
                      className="bt-button wide"
                    >
                      حوّل منزلي إلى 3D <Icon name="cube" />
                    </Link>
                    <button
                      className="bt-text-button"
                      onClick={analyze}
                      disabled={busy}
                    >
                      إعادة قراءة المخطط
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="bt-button wide"
                      onClick={analyze}
                      disabled={busy || health?.bimyConfigured === false}
                    >
                      {busy
                        ? "نقرأ مخططك…"
                        : analysis
                          ? "استكمال فهم المخطط"
                          : "ابدأ فهم المخطط"}
                      <Icon name="arrow" />
                    </button>
                    {health?.bimyConfigured === false && (
                      <p className="bt-muted">
                        خدمة قراءة المخططات غير متاحة حاليًا. ملفك محفوظ ويمكنك
                        العودة إليه.
                      </p>
                    )}
                    {analysis && !busy && (
                      <p className="bt-muted">
                        القراءة لم تكتمل بعد. يمكنك استكمالها من الزر أعلاه.
                      </p>
                    )}
                  </>
                )}
                {ready && image && (
                  <details className="bt-more">
                    <summary>أسماء الغرف</summary>
                    <p>تعرّف إلى أسماء المساحات المكتوبة في المخطط.</p>
                    <button
                      className="bt-button secondary wide"
                      onClick={readNames}
                      disabled={readingNames}
                    >
                      {readingNames ? "نقرأ أسماء الغرف…" : "قراءة أسماء الغرف"}
                    </button>
                  </details>
                )}
                <a
                  href={"/api/uploads/" + id + "/file"}
                  className="bt-file-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="file" />
                  <span>
                    {upload.name}
                    <small>
                      الملف الأصلي · {(upload.size / 1024 / 1024).toFixed(2)} MB
                    </small>
                  </span>
                  <Icon name="expand" />
                </a>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
