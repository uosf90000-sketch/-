import Link from "next/link";

export default function Header(){
  return <header className="baytiNav">
    <Link href="/" className="baytiBrand" aria-label="بيتي">
      <span className="baytiMark">
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <path d="M4 13.5 14 5l10 8.5v9.25a1.25 1.25 0 0 1-1.25 1.25H5.25A1.25 1.25 0 0 1 4 22.75Z"/>
          <path d="M10 24v-7h8v7"/>
        </svg>
      </span>
      <span className="baytiBrandText"><b>بيتي</b><small>Interior Intelligence</small></span>
    </Link>

    <nav className="baytiNavLinks" aria-label="التنقل الرئيسي">
      <a href="#features">المزايا</a>
      <a href="#how">كيف يعمل</a>
      <a href="#experience">التجربة</a>
    </nav>

    <div className="baytiNavActions">
      <span className="baytiLiveDot"><i/> هندسة حقيقية</span>
      <Link className="baytiNavCta" href="/">ابدأ مشروعك</Link>
    </div>
  </header>;
}
