"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Icon from "@/components/ui/Icon";
import { recentProjects, type RecentProject } from "@/lib/client/projects";
import PlanPreview from "@/components/PlanPreview";
export default function Projects() {
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => {
    setProjects(recentProjects());
    setLoaded(true);
  }, []);
  return (
    <div className="bt-app">
      <Header />
      <main id="main-content" className="bt-section bt-projects">
        <div className="bt-section-heading">
          <div>
            <span className="bt-eyebrow">مساحة لأفكارك</span>
            <h1>مشاريعي</h1>
            <p>المشاريع التي فتحتها على هذا الجهاز.</p>
          </div>
          <Link href="/upload" className="bt-button">
            <Icon name="plus" />
            منزل جديد
          </Link>
        </div>
        <label className="bt-search-field">
          <Icon name="search" />
          <input
            aria-label="البحث في المشاريع"
            placeholder="ابحث باسم المشروع"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {!loaded ? (
          <p role="status">نستعيد مشاريعك…</p>
        ) : !projects.length ? (
          <div className="bt-empty">
            <Icon name="home" width="42" height="42" />
            <h2>منزلك الأول ينتظرك.</h2>
            <p>ارفع مخططًا لتبدأ، أو استكشف منزلًا تجريبيًا.</p>
            <Link className="bt-button" href="/upload">
              ابدأ بمخططك <Icon name="arrow" />
            </Link>
            <Link className="bt-text-link" href="/project/demo">
              استكشف التجربة
            </Link>
          </div>
        ) : (
          <div className="bt-project-grid">
            {projects
              .filter((p) => p.name.includes(q))
              .map((p) => (
                <Link
                  key={p.id}
                  href={"/project/" + encodeURIComponent(p.id)}
                  className="bt-project-card"
                >
                  <div className="bt-project-thumbnail">
                    {["png", "jpg", "jpeg", "webp"].includes(
                      p.extension || "",
                    ) ? (
                      <img
                        loading="lazy"
                        src={"/api/uploads/" + p.id + "/file"}
                        alt="معاينة المخطط"
                      />
                    ) : (
                      <Icon name="file" width="48" height="48" />
                    )}
                  </div>
                  <div>
                    <h3>{p.name}</h3>
                    <small>
                      آخر زيارة {new Date(p.seenAt).toLocaleDateString("ar-SA")}
                    </small>
                    <Icon name="arrow" />
                  </div>
                </Link>
              ))}
            {projects.filter((p) => p.name.includes(q)).length === 0 && (
              <p>لا توجد مشاريع بهذا الاسم.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
