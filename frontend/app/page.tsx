// PATH: frontend/app/page.tsx
"use client";
import Link from "next/link";

// icon and color fields removed from CARDS
const CARDS = [
  {
    title: "Market Intelligence",
    description: "Linked view of construction spend and cement demand across regions, countries and end-use segments. Historical trend decomposition and forward projections.",
    footer: "Historical: 2010–2024  |  Forecast: 2025–2029",
    href: "/market-intelligence/construction-overall",
    badge: "3 views",
  },
  {
    title: "Supply & Production",
    description: "US cement plant capacity by producer across states and regions. Global cement volumes and plant-level geographic insights.",
    footer: "Industry view  |  Long-term",
    href: "/supply-production/us-production-overview",
    badge: "3 views",
  },
  {
    title: "Business Performance",
    description: "Company benchmarking across scale, growth and exposure to construction and cement demand cycles — peer comparisons and portfolio diagnostics.",
    footer: "Company insights  |  Comparative diagnostics",
    href: "/business-performance/kpis",
    badge: "2 views",
  },
  {
    title: "Stock & Valuation",
    description: "Indexed share price performance for global cement and building materials companies. Analyst benchmarking section.",
    footer: "Monthly data  |  CapIQ sourced",
    href: "/stock-valuation/stock-price-overview",
    badge: "2 views",
  },
  {
    title: "Profit Pools",
    description: "Industry-level margin evolution and profit pool distribution across the construction and cement value chains.",
    footer: "Category-level margins  |  Revenue mix",
    href: "/business-performance/profit-pools",
    badge: "EBITDA",
  },
  {
    title: "Deck Builder",
    description: "Generate a complete PowerPoint deck with executive summary, growth charts, profit pool and KPI comparison slides.",
    footer: "Powered by think-cell",
    href: "/deck-builder",
    badge: "PPT",
  },
];

// icon field removed from FEATURES
const FEATURES = [
  {
    title: "Global Coverage",
    body: "Construction and cement data spanning 80+ countries across all major regions. Standardised definitions and a single flat-file source of truth.",
  },
  {
    title: "AI-Powered Insights",
    body: "Each chart page has Construct Lens — an AI assistant that answers questions directly from the chart data, or searches the web for market context.",
  },
  {
    title: "Mekko + Growth Views",
    body: "Variable-width Mekko charts show both market size and share simultaneously. Switch to growth view for YoY trends and CAGR breakdowns.",
  },
  {
    title: "US Plant Intelligence",
    body: "Interactive deck.gl map of every US cement plant — filter by company, capacity and region to analyse the competitive landscape.",
  },
  {
    title: "Company Diagnostics",
    body: "20+ financial KPIs benchmarked across peers — from EBITDA margin and ROIC to leverage and workforce efficiency.",
  },
  {
    title: "One-Click PPT Export",
    body: "Export any chart directly to a think-cell-powered PowerPoint slide, or build a full multi-slide deck from the Deck Builder page.",
  },
];

const STATS = [
  { value: "80+",  label: "Countries covered" },
  { value: "2010", label: "Data from" },
  { value: "2029", label: "Forecast horizon" },
  { value: "20+",  label: "KPIs tracked" },
  { value: "6",    label: "Module pages" },
  { value: "100%", label: "Bain-sourced data" },
];

const DATA_SOURCES = [
  { name: "GlobalData", desc: "Construction overall" },
  { name: "IHS Markit", desc: "Building products" },
  { name: "CemNet",     desc: "Plant capacity & geomap" },
  { name: "CapIQ",      desc: "Financials & stock prices" },
  { name: "think-cell", desc: "PPT export engine" },
  { name: "OpenAI",     desc: "AI assistant (Construct Lens)" },
];

export default function HomePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@500&display=swap');

        .home-wrap { font-family: 'DM Sans', sans-serif; }

        /* ── Hero ─────────────────────────────────────────── */
        .hero {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 48px;
          min-height: 320px;
          display: flex;
          align-items: flex-end;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #2d475a 70%, #1a1a1a 100%);
        }
        .hero-bg-img {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0.55;
        }
        .hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .hero-glow {
          position: absolute;
          top: -40px;
          left: -40px;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(225,28,42,0.18) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-content {
          position: relative;
          z-index: 10;
          padding: 48px 48px 40px;
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 40px;
        }
        .hero-left { flex: 1; min-width: 0; }

        /* Logos pinned to top-right corner */
        .hero-logos {
          position: absolute !important;
          top: 23px;
          right: 28px;
          z-index: 20;
        }

        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(225,28,42,0.15);
          border: 1px solid rgba(225,28,42,0.3);
          color: #fca5a5;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 20px;
          margin-bottom: 16px;
        }
        .hero-eyebrow-dot {
          width: 6px; height: 6px;
          background: #E11C2A;
          border-radius: 50%;
          animation: blink 2s infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }

        .hero-title {
          font-size: clamp(2.4rem, 4vw, 3.6rem);
          font-weight: 800;
          color: white;
          letter-spacing: -1.5px;
          line-height: 1.05;
          margin-bottom: 12px;
        }
        .hero-title-accent { color: #E11C2A; }

        .hero-subtitle {
          font-size: 16px;
          color: rgba(255,255,255,0.65);
          line-height: 1.6;
          max-width: 520px;
          margin-bottom: 28px;
          font-weight: 400;
        }

        .hero-cta-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .hero-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #E11C2A;
          color: white;
          font-size: 14px;
          font-weight: 700;
          padding: 10px 22px;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.15s, transform 0.1s;
          font-family: 'DM Sans', sans-serif;
        }
        .hero-cta-primary:hover { background: #c91424; transform: translateY(-1px); }
        .hero-cta-secondary {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.85);
          font-size: 14px;
          font-weight: 600;
          padding: 10px 22px;
          border-radius: 8px;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.12);
          transition: background 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .hero-cta-secondary:hover { background: rgba(255,255,255,0.13); }

        .hero-logos {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          flex-shrink: 0;
        }
        .hero-logos-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hero-logo-img {
          height: 45px;
          width: auto;
          object-fit: contain;
          opacity: 1;
        }
        .hero-logo-divider {
          width: 1px;
          height: 24px;
          background: rgba(255,255,255,0.3);
        }
        .hero-powered-by {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-weight: 500;
          text-align: right;
          margin-bottom: -10px;
        }

        /* ── Stats bar ──────────────────────────────────────── */
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 0;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-bottom: 56px;
          overflow: hidden;
        }
        .stat-item {
          padding: 20px 16px;
          text-align: center;
          border-right: 1px solid #f1f5f9;
          transition: background 0.15s;
        }
        .stat-item:last-child { border-right: none; }
        .stat-item:hover { background: #fef2f2; }
        .stat-value {
          font-size: 24px;
          font-weight: 800;
          color: #E11C2A;
          letter-spacing: -0.5px;
          font-family: 'DM Mono', monospace;
          line-height: 1;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 11.5px;
          color: #64748b;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* ── Section headers ────────────────────────────────── */
        .section-header { margin-bottom: 28px; }
        .section-eyebrow {
          font-size: 11px;
          font-weight: 700;
          color: #E11C2A;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .section-title {
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
        }
        .section-sub {
          font-size: 14px;
          color: #64748b;
          max-width: 560px;
          line-height: 1.6;
        }

        /* ── Module cards ───────────────────────────────────── */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 72px;
        }
        @media (max-width: 1024px) { .cards-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px)  { .cards-grid { grid-template-columns: 1fr; } }

        .module-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px 22px 18px;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.18s, border-color 0.18s, transform 0.12s;
          position: relative;
          overflow: hidden;
        }
        /* Left accent bar — always red, visible on hover */
        .module-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 3px;
          background: #E11C2A;
          opacity: 0;
          transition: opacity 0.18s;
          border-radius: 12px 0 0 12px;
        }
        .module-card:hover {
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 20px -4px rgba(0,0,0,0.09);
          border-color: #e2e8f0;
          transform: translateY(-2px);
        }
        .module-card:hover::before { opacity: 1; }

        /* Title + badge on same row */
        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .card-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.2px;
          line-height: 1.3;
          transition: color 0.15s;
          flex: 1;
          min-width: 0;
        }
        .module-card:hover .card-title { color: #E11C2A; }
        .card-badge {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 2px 7px;
          border-radius: 20px;
          letter-spacing: 0.04em;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .module-card:hover .card-badge {
          background: #fff1f1;
          border-color: #fecaca;
          color: #E11C2A;
        }
        .card-desc {
          font-size: 13px;
          color: #64748b;
          line-height: 1.6;
          flex: 1;
          margin-bottom: 16px;
        }
        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid #f1f5f9;
          margin-top: auto;
        }
        .card-footer-text {
          font-size: 11.5px;
          font-weight: 500;
          color: #94a3b8;
        }
        /* Arrow: circular on hover */
        .card-arrow {
          width: 24px; height: 24px;
          background: #f1f5f9;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 13px;
          transition: background 0.15s, color 0.15s, transform 0.15s;
          flex-shrink: 0;
        }
        .module-card:hover .card-arrow {
          background: #E11C2A;
          color: white;
          transform: translateX(2px);
        }

        /* ── Features ───────────────────────────────────────── */
        .features-section {
          background: #0f172a;
          border-radius: 16px;
          padding: 52px 48px;
          margin-bottom: 56px;
          position: relative;
          overflow: hidden;
        }
        .features-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .features-glow {
          position: absolute;
          bottom: -80px; right: -80px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(225,28,42,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .features-inner { position: relative; z-index: 1; }
        .features-header { margin-bottom: 36px; }
        .features-header .section-eyebrow { color: #f87171; }
        .features-header .section-title   { color: white; }
        .features-header .section-sub     { color: rgba(255,255,255,0.5); }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 1024px) { .features-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px)  { .features-grid { grid-template-columns: 1fr; } }

        .feature-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 22px;
          transition: background 0.15s, border-color 0.15s;
        }
        .feature-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(225,28,42,0.3);
        }
        /* .feature-icon removed — no icons */
        .feature-title {
          font-size: 14px;
          font-weight: 700;
          color: white;
          margin-bottom: 8px;
          letter-spacing: -0.1px;
        }
        .feature-body {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          line-height: 1.65;
        }

        /* ── Data sources ───────────────────────────────────── */
        .sources-section { margin-bottom: 56px; }
        .sources-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
        }
        @media (max-width: 1024px) { .sources-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px)  { .sources-grid { grid-template-columns: repeat(2, 1fr); } }

        .source-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          text-align: center;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .source-card:hover {
          border-color: #fca5a5;
          box-shadow: 0 2px 12px rgba(225,28,42,0.08);
        }
        .source-name {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.1px;
          margin-bottom: 4px;
          font-family: 'DM Mono', monospace;
        }
        .source-desc {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }
      `}</style>

      <div className="home-wrap">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className="hero">
          <div className="hero-bg" />
          <div
            className="hero-bg-img"
            style={{ backgroundImage: "url('/background.png')" }}
          />
          <div className="hero-grid" />
          <div className="hero-glow" />

          <div className="hero-content">
            <div className="hero-left">
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-dot" />
                Bain &amp; BCN · Cement Intelligence
              </div>

              <h1 className="hero-title">
                CemIQ<br />
                <span className="hero-title-accent">Intelligence</span>{" "}
                <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Platform</span>
              </h1>

              <p className="hero-subtitle">
                Smarter diagnostics and KPI intelligence for cement and beyond —
                an integrated view of construction activity, demand and profitability
                across historical and forecast horizons.
              </p>

              <div className="hero-cta-row">
                <Link href="/market-intelligence/construction-overall" className="hero-cta-primary">
                  Explore Market Intelligence
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link href="/deck-builder" className="hero-cta-secondary">
                  Build a Deck
                </Link>
              </div>
            </div>

            <div className="hero-logos">
              <div className="hero-powered-by">Powered by</div>
              <div className="hero-logos-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bainlogo.png" alt="Bain" className="hero-logo-img"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="hero-logo-divider" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bcnlogo.png" alt="BCN" className="hero-logo-img"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS BAR ────────────────────────────────────────── */}
        <div className="stats-bar">
          {STATS.map((s) => (
            <div key={s.label} className="stat-item">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── MODULE CARDS ─────────────────────────────────────── */}
        <div className="section-header">
          <div className="section-eyebrow">Platform Modules</div>
          <h2 className="section-title">Everything you need in one platform</h2>
          <p className="section-sub">
            Six integrated modules covering the full cement and construction intelligence stack —
            from macro demand to company-level diagnostics and investor analytics.
          </p>
        </div>

        <div className="cards-grid">
          {CARDS.map((card) => (
            <Link key={card.href} href={card.href} className="module-card">
              <div className="card-top">
                <div className="card-title">{card.title}</div>
                <div className="card-badge">{card.badge}</div>
              </div>
              <div className="card-desc">{card.description}</div>
              <div className="card-footer">
                <div className="card-footer-text">{card.footer}</div>
                <div className="card-arrow">→</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── FEATURES ─────────────────────────────────────────── */}
        <div className="features-section">
          <div className="features-bg-grid" />
          <div className="features-glow" />
          <div className="features-inner">
            <div className="features-header section-header">
              <div className="section-eyebrow">Why CemIQ</div>
              <h2 className="section-title">Built for cement professionals</h2>
              <p className="section-sub">
                Every feature designed for the way analysts, consultants and strategists
                actually work with cement data.
              </p>
            </div>
            <div className="features-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="feature-card">
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-body">{f.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DATA SOURCES ─────────────────────────────────────── */}
        <div className="sources-section">
          <div className="section-header">
            <div className="section-eyebrow">Data Sources</div>
            <h2 className="section-title">Trusted data, one platform</h2>
            <p className="section-sub">
              All data is sourced from best-in-class providers and standardised into
              a single integrated data model.
            </p>
          </div>
          <div className="sources-grid">
            {DATA_SOURCES.map((s) => (
              <div key={s.name} className="source-card">
                <div className="source-name">{s.name}</div>
                <div className="source-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}