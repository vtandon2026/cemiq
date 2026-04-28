// PATH: frontend/components/layout/Navbar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const NAV_ITEMS = [
  {
    label: "Market Intelligence",
    children: [
      { label: "Construction Overall", href: "/market-intelligence/construction-overall", desc: "Global construction revenue by region" },
      { label: "Building Materials Sales", href: "/market-intelligence/building-materials", desc: "Building products market breakdown" },
      { label: "Cement Sales", href: "/market-intelligence/cement-sales", desc: "Cement & concrete demand trends" },
      { label: "Cement Demand", href: "/market-intelligence/cement-demand", desc: "Demand & consumption growth by country" },
      { label: "Executive Summary", href: "/market-intelligence/executive-summary", desc: "AI-generated country outlooks" },
    ],
  },
  {
    label: "Construction Detail",
    children: [
      { label: "Construction Detail", href: "/construction-detail/construction-detail", desc: "Segment-level construction activity · Mekko & Growth view" },
    ],
  },
  {
    label: "Supply & Production",
    children: [
      { label: "US Production Overview", href: "/supply-production/us-production-overview", desc: "Capacity by producer & state" },
      { label: "US Plant Level Insights", href: "/supply-production/us-plant-insights", desc: "Interactive plant location map" },
      { label: "Global Cement Volumes", href: "/supply-production/global-cement-volumes", desc: "Country-level production data" },
    ],
  },
  {
    label: "Business Performance",
    children: [
      { label: "KPIs", href: "/business-performance/kpis", desc: "Company financial diagnosis" },
      { label: "Profit Pools", href: "/business-performance/profit-pools", desc: "EBITDA margin by category" },
    ],
  },
  {
    label: "Stock & Valuation",
    children: [
      { label: "Stock Price Overview", href: "/stock-valuation/stock-price-overview", desc: "Indexed share price performance" },
      { label: "Analyst Section", href: "/stock-valuation/analyst-section", desc: "Analyst benchmarking" },
    ],
  },
  {
  label: "Cement Specific",
  children: [
    {
      label: "Capacity Concentration",
      href:  "/cement-specific/capacity-concentration",
      desc:  "Top 3 share of local production capacity by country",
    },
  ],
},
];

export default function Navbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on route change
  useEffect(() => { setOpenMenu(null); }, [pathname]);

  // Scroll shadow
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const groupActive = (children: { href: string }[]) =>
    children.some((c) => isActive(c.href));

  const toggleMenu = (label: string) =>
    setOpenMenu((prev) => (prev === label ? null : label));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');

        .cemiq-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          font-family: 'DM Sans', sans-serif;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: box-shadow 0.25s ease;
        }
        .cemiq-nav.scrolled {
          box-shadow: 0 1px 0 rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.07);
        }

        .nav-inner {
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 20px;
          height: 52px;
          display: flex;
          align-items: center;
          gap: 0;
        }

        /* ── Logo ───────────────────────────────────────────────── */
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          margin-right: 28px;
          flex-shrink: 0;
        }
        .nav-logo-badge {
          background: #E11C2A;
          color: white;
          font-family: 'DM Mono', monospace;
          font-size: 16px;
          font-weight: 500;
          letter-spacing: 0.02em;
          padding: 9px 10px;
          border-radius: 6px;
          line-height: 1;
        }
        .nav-logo-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.3px;
        }
        .nav-logo-tagline {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 400;
        }

        /* ── Nav items ──────────────────────────────────────────── */
        .nav-items {
          display: flex;
          align-items: center;
          gap: 2px;
          flex: 1;
        }
        .nav-item { position: relative; }

        .nav-trigger {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 11px;
          border-radius: 7px;
          font-size: 13.5px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          border: none;
          background: transparent;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: -0.1px;
          user-select: none;
        }
        .nav-trigger:hover,
        .nav-trigger.open {
          background: #f1f5f9;
          color: #0f172a;
        }
        .nav-trigger.active-group {
          color: #dc2626;
          background: #fef2f2;
        }
        .nav-trigger.open.active-group {
          background: #fee2e2;
        }

        .nav-chevron {
          width: 14px;
          height: 14px;
          color: #94a3b8;
          transition: transform 0.2s ease, color 0.15s;
          flex-shrink: 0;
        }
        .nav-trigger.open .nav-chevron {
          transform: rotate(180deg);
          color: #475569;
        }
        .nav-trigger.active-group .nav-chevron {
          color: #dc2626;
        }

        /* ── Dropdown ───────────────────────────────────────────── */
        .nav-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 6px;
          min-width: 270px;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.03),
            0 4px 6px -1px rgba(0,0,0,0.07),
            0 12px 32px -4px rgba(0,0,0,0.13);
          animation: dropIn 0.14s ease;
          z-index: 200;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0px); }
        }
        /* Arrow pointer */
        .nav-dropdown::before {
          content: '';
          position: absolute;
          top: -5px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 10px;
          height: 10px;
          background: white;
          border-left: 1px solid #e2e8f0;
          border-top: 1px solid #e2e8f0;
        }

        /* ── Dropdown items ─────────────────────────────────────── */
        .nav-dropdown-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 9px 11px;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.1s, color 0.1s;
          cursor: pointer;
          position: relative;
        }
        /* Hover: red tint bg, red label */
        .nav-dropdown-item:hover {
          background: #fff1f1;
        }
        .nav-dropdown-item:hover .nav-dropdown-item-label {
          color: #dc2626;
        }
        .nav-dropdown-item:hover .nav-dropdown-item-desc {
          color: #fca5a5;
        }
        /* Active page: stronger red */
        .nav-dropdown-item.active {
          background: #fef2f2;
        }
        .nav-dropdown-item.active .nav-dropdown-item-label {
          color: #dc2626;
        }
        .nav-dropdown-item.active .nav-dropdown-item-desc {
          color: #f87171;
        }
        /* Active indicator dot */
        .nav-dropdown-item.active::before {
          content: '';
          position: absolute;
          left: 3px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: #E11C2A;
          border-radius: 2px;
        }

        .nav-dropdown-item-label {
          font-size: 13.5px;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: -0.1px;
          transition: color 0.1s;
        }
        .nav-dropdown-item-desc {
          font-size: 11.5px;
          color: #94a3b8;
          font-weight: 400;
          line-height: 1.3;
          transition: color 0.1s;
        }
        .nav-dropdown-divider {
          height: 1px;
          background: #f1f5f9;
          margin: 4px 6px;
        }

        /* ── Right actions ──────────────────────────────────────── */
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          flex-shrink: 0;
        }
        .nav-status {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          color: #64748b;
        }
        .nav-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse-green 2s infinite;
        }
        @keyframes pulse-green {
          0%,100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.25); }
          50%      { box-shadow: 0 0 0 4px rgba(34,197,94,0.12); }
        }
        .nav-deck-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: #0f172a;
          color: white;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.15s, transform 0.1s;
          letter-spacing: -0.1px;
          font-family: 'DM Sans', sans-serif;
          white-space: nowrap;
        }
        .nav-deck-btn:hover  { background: #1e293b; transform: translateY(-1px); }
        .nav-deck-btn.active { background: #E11C2A; }
        .nav-deck-btn.active:hover { background: #c91424; }

        /* ── Accent bar ─────────────────────────────────────────── */
        .nav-accent-bar {
          height: 2px;
          background: linear-gradient(90deg, #E11C2A 0%, #ff6b6b 40%, #E11C2A 100%);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Overlay (click-outside catcher) ────────────────────── */
        .nav-overlay {
          position: fixed;
          inset: 0;
          z-index: 99;
        }
      `}</style>

      {/* Top accent bar */}
      <div className="nav-accent-bar" />

      {/* Click-outside overlay when any dropdown is open */}
      {openMenu && (
        <div className="nav-overlay" onClick={() => setOpenMenu(null)} />
      )}

      <nav className={`cemiq-nav ${scrolled ? "scrolled" : ""}`} ref={navRef}>
        <div className="nav-inner">

          {/* Logo */}
          <Link href="/" className="nav-logo" onClick={() => setOpenMenu(null)}>
            <span className="nav-logo-badge">CemIQ</span>
            <div>
              <div className="nav-logo-name">Intelligence Platform</div>
              <div className="nav-logo-tagline">Cement & Construction</div>
            </div>
          </Link>

          {/* Nav items */}
          <div className="nav-items">
            {NAV_ITEMS.map((item) => {
              const isOpen = openMenu === item.label;
              const isGroupActive = groupActive(item.children);

              return (
                <div key={item.label} className="nav-item">
                  {/* Trigger — click to toggle, stays open */}
                  <button
                    className={[
                      "nav-trigger",
                      isOpen ? "open" : "",
                      isGroupActive ? "active-group" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => toggleMenu(item.label)}
                  >
                    <span>{item.label}</span>
                    <svg className="nav-chevron" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {isOpen && (
                    <div className="nav-dropdown">
                      {item.children.map((child, idx) => (
                        <div key={child.href}>
                          {/* {idx > 0 && idx === item.children.length - 1 && item.children.length > 2 && (
                            <div className="nav-dropdown-divider" />
                          )} */}
                          <Link
                            href={child.href}
                            className={`nav-dropdown-item ${isActive(child.href) ? "active" : ""}`}
                            onClick={() => setOpenMenu(null)}
                          >
                            <span className="nav-dropdown-item-label">{child.label}</span>
                            <span className="nav-dropdown-item-desc">{child.desc}</span>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="nav-actions">
            <div className="nav-status">
              <span className="nav-status-dot" />
              Live
            </div>
            <Link
              href="/deck-builder"
              className={`nav-deck-btn ${isActive("/deck-builder") ? "active" : ""}`}
              onClick={() => setOpenMenu(null)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Deck Builder
            </Link>
          </div>

        </div>
      </nav>
    </>
  );
}