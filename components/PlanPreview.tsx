"use client";
import { useState } from "react";
import Icon from "./ui/Icon";
export default function PlanPreview({
  url,
  extension,
  name,
}: {
  url: string;
  extension?: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  if (extension === "pdf")
    return (
      <object
        className="bt-file-preview"
        data={url + "#toolbar=0"}
        type="application/pdf"
        aria-label={name}
      >
        <div className="bt-empty compact">
          <Icon name="file" />
          <p>المخطط بصيغة PDF</p>
          <a
            className="bt-button secondary"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            افتح المعاينة
          </a>
        </div>
      </object>
    );
  if (failed || !["png", "jpg", "jpeg", "webp"].includes(extension || ""))
    return (
      <div className="bt-empty compact">
        <Icon name="file" />
        <h3>{name}</h3>
        <p>تظهر معاينة المنزل بعد اكتمال القراءة.</p>
        <a href={url} className="bt-text-link" download>
          تنزيل الملف الأصلي
        </a>
      </div>
    );
  return (
    <img
      className="bt-plan-image"
      src={url}
      alt={"مخطط " + name}
      onError={() => setFailed(true)}
    />
  );
}
