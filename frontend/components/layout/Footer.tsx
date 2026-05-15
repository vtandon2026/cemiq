"use client";
import Link from "next/link";

const NAV_LINKS = [
  {
    section: "Construction Markets",
    links: [
      { label: "Construction Market Overview", href: "/construction-detail/construction-detail" },
      { label: "Global Construction Map",      href: "/construction-detail/world-view-map" },
    ],
  },
  {
    section: "Cement Analytics",
    links: [
      { label: "Capacity Concentration",    href: "/cement-specific/capacity-concentration" },
      { label: "Company Capacity Overview", href: "/cement-specific/company-capacity" },
      { label: "M&A Activity",              href: "/cement-specific/ma-deals" },
      { label: "Cement Sales",              href: "/cement-specific/cement-sales" },
      { label: "Cement Demand",             href: "/cement-specific/cement-demand" },
    ],
  },
  {
    section: "Supply & Production",
    links: [
      { label: "US Production Overview",  href: "/supply-production/us-production-overview" },
      { label: "US Plant Level Insights", href: "/supply-production/us-plant-insights" },
      { label: "Global Cement Volumes",   href: "/supply-production/global-cement-volumes" },
    ],
  },
  {
    section: "Business Performance",
    links: [
      { label: "KPIs", href: "/business-performance/kpis" },
    ],
  },
  {
    section: "Stock & Valuation",
    links: [
      { label: "Stock Price Overview", href: "/stock-valuation/stock-price-overview" },
      { label: "Analyst Section",      href: "/stock-valuation/analyst-section" },
    ],
  },
  {
    section: "ESG & Future Tech",
    links: [
      { label: "The Carbon Problem",         href: "/esg-and-future-tech/the-carbon-problem" },
      { label: "Transition Readiness",       href: "/esg-and-future-tech/transition-readiness" },
      { label: "The Future of Green Cement", href: "/esg-and-future-tech/future-of-green-cement" },
    ],
  },
];

export default function Footer() {
  return (
    <>
      <style>{`
        .site-footer { border-top:1px solid var(--bain-gray-100); padding:24px 0 16px; margin-top:15px; font-family:Arial,Helvetica,sans-serif; }
        .footer-inner { max-width:1600px; margin:0 auto; padding:0 20px; }
        .footer-top { display:grid; grid-template-columns:1.6fr repeat(6,1fr); gap:32px; }
        @media(max-width:1024px){.footer-top{grid-template-columns:1fr 1fr;}}
        @media(max-width:640px){.footer-top{grid-template-columns:1fr;}}
        .footer-logo-badge { display:inline-block; background:var(--bain-red); color:white; font-size:13px; font-weight:700; padding:4px 10px; border-radius:6px; margin-bottom:12px; letter-spacing:0.02em; }
        .footer-tagline { font-size:13px; color:var(--bain-gray); line-height:1.65; max-width:240px; margin-bottom:16px; }
        .footer-bain-logos { display:flex; align-items:center; gap:12px; }
        .footer-bain-logo { height:36px; width:auto; object-fit:contain; }
        .footer-col-title { font-size:11px; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:10px; }
        .footer-links { display:flex; flex-direction:column; gap:8px; }
        .footer-link { font-size:13px; color:var(--bain-gray); text-decoration:none; transition:color 0.12s; font-weight:400; }
        .footer-link:hover { color:var(--bain-red); }
        .footer-bottom { display:flex; align-items:center; justify-content:space-between; padding-top:20px; border-top:1px solid var(--bain-gray-100); gap:16px; flex-wrap:wrap; }
        .footer-copy { font-size:11.5px; color:var(--bain-gray); }
        .footer-meta { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .footer-meta-chip { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--bain-gray); font-weight:500; }
        .footer-meta-dot { width:5px; height:5px; border-radius:50%; background:#22c55e; }
      `}</style>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-top">

            {/* Brand */}
            <div>
              <div className="footer-logo-badge">CemIQ</div>
              <p className="footer-tagline">
                Cement and construction intelligence platform built by Bain &amp; BCN.
                Data-driven insights for the global cement industry.
              </p>
              <div className="footer-bain-logos">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bainlogo.png" alt="Bain" className="footer-bain-logo"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bcnlogo.png" alt="BCN" className="footer-bain-logo"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            </div>

            {/* Nav columns */}
            {NAV_LINKS.map(col => (
              <div key={col.section}>
                <div className="footer-col-title">{col.section}</div>
                <div className="footer-links">
                  {col.links.map(l => (
                    <Link key={l.href} href={l.href} className="footer-link">{l.label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="footer-bottom" style={{ marginTop: 24 }}>
            <div className="footer-copy">
              © {new Date().getFullYear()} Bain &amp; Company · BCN · CemIQ Platform
            </div>
            <div className="footer-meta">
              <div className="footer-meta-chip">
                <span className="footer-meta-dot" />
                Platform live
              </div>
              <div className="footer-meta-chip">16 active pages</div>
              <div className="footer-meta-chip">Forecast to 2029</div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}