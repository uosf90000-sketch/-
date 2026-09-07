"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Icon from "@/components/ui/Icon";
import PlanPreview from "@/components/PlanPreview";
import { rememberProject } from "@/lib/client/projects";
const allowed = ["png", "jpg", "jpeg", "webp", "pdf", "dxf", "dwg"];
const accept = ".png,.jpg,.jpeg,.webp,.pdf,.dxf,.dwg";
export default function Upload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null),
    photos = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  function choose(picked?: File) {
    if (!picked || busy) return;
    setError("");
    const ext = picked.name.split(".").pop()?.toLowerCase();
    if (!ext || !allowed.includes(ext)) {
      setError(
        ext === "ifc"
          ? "رفع IFC المباشر لم يتوفر بعد. اختر نسخة PDF أو صورة للمخطط."
          : "اختر صورة PNG أو JPG أو WEBP، أو ملف PDF أو DXF أو DWG.",
      );
      return;
    }
    if (!picked.size || picked.size > 25 * 1024 * 1024) {
      setError("اختر ملفًا غير فارغ بحجم لا يتجاوز 25 ميجابايت.");
      return;
    }
    setFile(picked);
  }
  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("plan", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(body.error || "تعذر رفع المخطط. حاول مرة أخرى.");
      rememberProject(body.upload);
      const chosen = new URLSearchParams(window.location.search).get("style");
      router.push(
        "/project/" +
          encodeURIComponent(body.upload.id) +
          (chosen ? "?style=" + encodeURIComponent(chosen) : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر رفع المخطط.");
      setBusy(false);
    }
  }
  return (
    <div className="bt-app">
      <Header />
      <main id="main-content" className="bt-upload-page">
        <div className="bt-page-title">
          <span className="bt-eyebrow">الخطوة الأولى نحو منزلك</span>
          <h1>لنبدأ من مخطط منزلك</h1>
          <p>ارفع المخطط وسنتولى الباقي.</p>
        </div>
        <div
          className={"bt-upload-card " + (file ? "has-file" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            choose(e.dataTransfer.files[0]);
          }}
        >
          <input
            className="bt-visually-hidden"
            tabIndex={-1}
            ref={input}
            type="file"
            accept={accept}
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            className="bt-visually-hidden"
            tabIndex={-1}
            ref={photos}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            className="bt-visually-hidden"
            tabIndex={-1}
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {file ? (
            <>
              <div className="bt-upload-preview">
                <PlanPreview
                  key={url}
                  url={url}
                  extension={file.name.split(".").pop()?.toLowerCase()}
                  name={file.name}
                />
              </div>
              <div className="bt-upload-file">
                <Icon name="file" />
                <div>
                  <b>{file.name}</b>
                  <small>
                    {(file.size / 1024 / 1024).toFixed(2)} MB · جاهز للرفع
                  </small>
                </div>
                <button
                  className="bt-icon"
                  onClick={() => setFile(null)}
                  disabled={busy}
                  aria-label="إزالة الملف"
                >
                  <Icon name="close" />
                </button>
              </div>
              <button
                className="bt-button wide"
                onClick={upload}
                disabled={busy}
              >
                {busy ? "نحفظ مخططك…" : "متابعة إلى مراجعة المخطط"}
                <Icon name="arrow" />
              </button>
              <button
                className="bt-text-button"
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                اختيار ملف آخر
              </button>
            </>
          ) : (
            <>
              <div className={"bt-dropzone " + (drag ? "dragging" : "")}>
                <div className="bt-upload-symbol">
                  <Icon name="upload" width="38" height="38" />
                </div>
                <h2>{drag ? "ضع مخططك هنا" : "اسحب المخطط هنا"}</h2>
                <p>كل منزل عظيم، يبدأ بفكرة.</p>
                <button
                  className="bt-button"
                  onClick={() => input.current?.click()}
                >
                  اختر ملفًا <Icon name="plus" />
                </button>
                <span className="bt-formats" dir="ltr">
                  PDF · PNG · JPG · WEBP · DXF · DWG
                </span>
                <small>حتى 25 ميجابايت</small>
              </div>
              <div className="bt-upload-sources">
                <button onClick={() => input.current?.click()}>
                  <Icon name="file" />
                  الملفات
                </button>
                <button onClick={() => photos.current?.click()}>
                  <Icon name="image" />
                  الصور
                </button>
                <button onClick={() => camera.current?.click()}>
                  <Icon name="camera" />
                  الكاميرا
                </button>
              </div>
            </>
          )}
          {error && (
            <div className="bt-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <p className="bt-upload-tip">
          <Icon name="info" />
          صورة واضحة للمخطط كاملًا تساعدنا على فهم منزلك.
        </p>
      </main>
    </div>
  );
}
