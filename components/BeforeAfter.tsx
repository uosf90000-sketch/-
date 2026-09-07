"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import PlanMap from "./PlanMap";
import { demoAnalysis, demoDesign } from "@/lib/demo-home";
const Model = dynamic(() => import("./RealHouse3D"), {
  ssr: false,
  loading: () => <div className="bt-model-loading">نجهّز المنزل التجريبي…</div>,
});
export default function BeforeAfter() {
  const [value, setValue] = useState(50);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="bt-compare">
      <div className="bt-compare-plan">
        <PlanMap analysis={demoAnalysis} interactive={false} />
      </div>
      <div
        className="bt-compare-model"
        style={{ clipPath: `inset(0 0 0 ${value}%)` }}
      >
        {visible && (
          <Model analysis={demoAnalysis} design={demoDesign} activeRoom={-1} />
        )}
      </div>
      <span className="bt-compare-label before">المخطط</span>
      <span className="bt-compare-label after">المنزل ثلاثي الأبعاد</span>
      <div className="bt-compare-divider" style={{ left: `${value}%` }}>
        <span>‹ ›</span>
      </div>
      <input
        dir="ltr"
        aria-label="مقارنة المخطط بالمنزل ثلاثي الأبعاد"
        aria-valuetext={`المخطط ${value} بالمئة`}
        type="range"
        min="5"
        max="95"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </div>
  );
}
