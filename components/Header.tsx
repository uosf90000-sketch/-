import Link from "next/link";

export default function Header(){
  return <header className="topbar">
    <Link href="/" className="brand"><span className="brandIcon">⌂</span><span><b>بيتي</b><small>تخيّل · صمّم · عشها</small></span></Link>
    <nav><a href="#features">المزايا</a><a href="#how">كيف يعمل؟</a><a href="#styles">الأساليب</a><a href="#pricing">الأسعار</a></nav>
    <div className="headerActions"><button className="lang">EN ◉</button><button className="btn ghost">تسجيل الدخول</button><Link className="btn gold" href="/project/demo">ابدأ الآن</Link></div>
  </header>
}
