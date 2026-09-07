import Link from "next/link";
import Header, { Brand } from "@/components/Header";
import Icon from "@/components/ui/Icon";
import BeforeAfter from "@/components/BeforeAfter";
export default function Home() {
  return (
    <div className="bt-app">
      <Header />
      <main id="main-content">
        <section className="bt-hero">
          <div className="bt-hero-copy">
            <span className="bt-eyebrow">منزل يشبهك، من أول فكرة.</span>
            <h1>
              من مخطط…
              <br />
              إلى بيت تعيشه
              <br />
              <em>قبل أن تبنيه.</em>
            </h1>
            <p>
              ارفع مخطط منزلك، وصممه واستكشفه.
              <br />
              شاهد المساحات، والمس الخامات، وتخيّل حياتك فيه.
            </p>
            <div className="bt-hero-actions">
              <Link className="bt-button" href="/upload">
                ابدأ بمخططك <Icon name="arrow" />
              </Link>
              <a className="bt-button secondary" href="#how">
                <Icon name="play" /> شاهد كيف يعمل
              </a>
            </div>
            <small className="bt-formats" dir="ltr">
              PNG · JPG · PDF · DXF · DWG
            </small>
          </div>
          <div className="bt-hero-image">
            <img
              src="/images/villa.webp"
              alt="مدخل فيلا سعودية معاصرة بالحجر الطبيعي والنخيل"
              fetchPriority="high"
            />
            <div className="bt-image-caption">
              <span>كل بيت، قصة أجمل.</span>
              <small>مساحات تعكس أسلوب حياتك</small>
            </div>
          </div>
        </section>
        <div className="bt-values">
          <span>
            <Icon name="home" />
            تصميم بروح سعودية
          </span>
          <span>
            <Icon name="layers" />
            من الفكرة إلى المساحة
          </span>
          <span>
            <Icon name="compass" />
            أنت صاحب التفاصيل
          </span>
        </div>
        <section className="bt-section bt-transform" id="experience">
          <div className="bt-section-heading">
            <div>
              <span className="bt-eyebrow">شاهد الفكرة تأخذ شكلها</span>
              <h2>مخططك هو البداية فقط.</h2>
            </div>
            <p>
              حرّك الفاصل لتستكشف المنزل نفسه
              <br />
              من المخطط إلى ثلاثي الأبعاد.
            </p>
          </div>
          <BeforeAfter />
          <div className="bt-section-foot">
            <small>منزل تجريبي يوضح التجربة، وليس نتيجة لمخططك.</small>
            <Link href="/project/demo" className="bt-text-link">
              استكشف المنزل التجريبي <Icon name="arrow" />
            </Link>
          </div>
        </section>
        <section className="bt-section" id="how">
          <div className="bt-section-heading">
            <div>
              <span className="bt-eyebrow">خطوة أقرب إلى منزلك</span>
              <h2>رحلة تبدأ بورقة.</h2>
            </div>
          </div>
          <div className="bt-story">
            {[
              {
                n: "01",
                t: "ارفع مخططك",
                d: "صورة أو ملف. هنا تبدأ الحكاية.",
                icon: "upload",
              },
              {
                n: "02",
                t: "نفهم المنزل",
                d: "الجدران، الفتحات، والمساحات.",
                icon: "layers",
              },
              {
                n: "03",
                t: "شاهد منزلك",
                d: "أبعاد تتحول إلى مساحة أمامك.",
                icon: "cube",
              },
              {
                n: "04",
                t: "اختر التصميم",
                d: "خامات وأثاث يناسبان أسلوبك.",
                icon: "spark",
              },
              {
                n: "05",
                t: "ادخل منزلك",
                d: "تجوّل، وتعرّف إلى كل تفصيلة.",
                icon: "walk",
              },
            ].map((s) => (
              <article key={s.n}>
                <span className="bt-story-number">{s.n}</span>
                <Icon name={s.icon as any} />
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="bt-inspiration">
          <img
            src="/images/majlis.webp"
            alt="مجلس معاصر بخامات طبيعية وأثاث عاجي"
            loading="lazy"
          />
          <div>
            <span className="bt-eyebrow">مساحة لذوقك</span>
            <h2>
              منزلك.
              <br />
              بكل ما يشبهك.
            </h2>
            <p>
              دفء الخشب، هدوء الحجر، وضوء يدخل كل زاوية. اكتشف الاتجاه الذي
              يناسبك.
            </p>
            <Link className="bt-button" href="/explore">
              استكشف التصاميم <Icon name="arrow" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="bt-footer">
        <Brand />
        <span>من مخطط… إلى منزل.</span>
        <Link href="/upload">
          ابدأ حكاية منزلك <Icon name="arrow" />
        </Link>
      </footer>
    </div>
  );
}
