import Link from "next/link";
import Header from "@/components/Header";
import Icon from "@/components/ui/Icon";
import { designStyles } from "@/lib/styles";
export default function Explore() {
  return (
    <div className="bt-app">
      <Header />
      <main id="main-content" className="bt-section">
        <div className="bt-page-title">
          <span className="bt-eyebrow">أفكار تسكن معك</span>
          <h1>أي منزل يشبهك؟</h1>
          <p>اكتشف اتجاهك، ثم امنحه مساحة في مخططك.</p>
        </div>
        <div className="bt-style-gallery">
          {designStyles.map((s, i) => (
            <Link
              className={"bt-style-feature feature-" + i}
              href={"/upload?style=" + encodeURIComponent(s.id)}
              key={s.id}
            >
              <span
                className="bt-style-cover"
                role="img"
                aria-label={"اتجاه بصري مستوحى من " + s.name}
                style={{
                  backgroundImage: `url(${s.image})`,
                  backgroundPosition: s.position,
                  backgroundSize: s.size,
                }}
              />
              <div>
                <small dir="ltr">{s.id}</small>
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <span>
                  ابدأ بهذا الاتجاه <Icon name="arrow" />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className="bt-muted">
          صور إلهامية؛ يتشكل تصميم منزلك حسب مخططك والمساحات المتاحة.
        </p>
      </main>
    </div>
  );
}
