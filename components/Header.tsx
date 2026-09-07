"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Icon, { type IconName } from "./ui/Icon";
import Sheet from "./ui/Sheet";
import { recentProjects } from "@/lib/client/projects";
const links: { href: string; title: string; icon: IconName }[] = [
  { href: "/", title: "الرئيسية", icon: "home" },
  { href: "/dashboard", title: "مشاريعي", icon: "folder" },
  { href: "/explore", title: "استكشف التصاميم", icon: "compass" },
];
export function Brand() {
  return (
    <Link className="bt-brand" href="/" aria-label="بيتي — الرئيسية">
      بيتي<span>BAYTI</span>
    </Link>
  );
}
export default function Header() {
  const pathname = usePathname();
  const [panel, setPanel] = useState<
    "search" | "notifications" | "account" | null
  >(null);
  const [query, setQuery] = useState("");
  const results =
    panel === "search"
      ? recentProjects().filter((p) => p.name.includes(query.trim()))
      : [];
  return (
    <>
      <a href="#main-content" className="bt-skip">
        تجاوز إلى المحتوى
      </a>
      <header className="bt-header">
        <Brand />
        <nav aria-label="التنقل الرئيسي">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
            >
              {l.title}
            </Link>
          ))}
        </nav>
        <div className="bt-header-actions">
          <button
            className="bt-icon"
            aria-label="بحث في المشاريع"
            onClick={() => setPanel("search")}
          >
            <Icon name="search" />
          </button>
          <button
            className="bt-icon bt-notification"
            aria-label="الإشعارات"
            onClick={() => setPanel("notifications")}
          >
            <Icon name="bell" />
          </button>
          <button
            className="bt-avatar"
            aria-label="حسابي"
            onClick={() => setPanel("account")}
          >
            <Icon name="user" />
          </button>
        </div>
      </header>
      <nav className="bt-bottom-nav" aria-label="التنقل على الجوال">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname === l.href ? "page" : undefined}
          >
            <Icon name={l.icon} />
            <span>{l.href === "/explore" ? "استكشف" : l.title}</span>
          </Link>
        ))}
        <button onClick={() => setPanel("account")}>
          <Icon name="user" />
          <span>حسابي</span>
        </button>
      </nav>
      {panel && (
        <Sheet
          title={
            panel === "search"
              ? "ابحث عن منزلك"
              : panel === "account"
                ? "مساحتك في بيتي"
                : "الإشعارات"
          }
          onClose={() => setPanel(null)}
        >
          {panel === "search" ? (
            <>
              <label className="bt-search-field">
                <Icon name="search" />
                <input
                  autoFocus
                  placeholder="اسم المشروع…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="اسم المشروع"
                />
              </label>
              <div className="bt-search-results">
                {results.length ? (
                  results.map((p) => (
                    <Link
                      key={p.id}
                      href={"/project/" + p.id}
                      onClick={() => setPanel(null)}
                    >
                      <Icon name="folder" />
                      <span>{p.name}</span>
                      <Icon name="arrow" />
                    </Link>
                  ))
                ) : (
                  <p className="bt-muted">
                    لا توجد مشاريع مطابقة على هذا الجهاز.
                  </p>
                )}
              </div>
            </>
          ) : panel === "account" ? (
            <div className="bt-empty compact">
              <Icon name="home" />
              <h3>كل بداية، بيت جديد.</h3>
              <p>
                يمكنك العودة إلى المشاريع التي فتحتها على هذا الجهاز. تسجيل
                الحسابات لم يتوفر بعد.
              </p>
              <Link
                className="bt-button"
                href="/dashboard"
                onClick={() => setPanel(null)}
              >
                مشاريعي <Icon name="arrow" />
              </Link>
            </div>
          ) : (
            <div className="bt-empty compact">
              <Icon name="bell" />
              <h3>لا توجد إشعارات حاليًا</h3>
              <p>حالة قراءة المخطط والتصميم تظهر داخل مشروعك.</p>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
