// // PATH: frontend/components/layout/Footer.tsx
// "use client";
// import Link from "next/link";

// const NAV_LINKS = [
//     {
//         section: "Market Intelligence",
//         links: [
//             { label: "Construction Overall", href: "/market-intelligence/construction-overall" },
//             { label: "Building Materials Sales", href: "/market-intelligence/building-materials" },
//             { label: "Cement Sales", href: "/market-intelligence/cement-sales" },
//             { label: "Cement Demand", href: "/market-intelligence/cement-demand" },
//             { label: "Executive Summary", href: "/market-intelligence/executive-summary" },
//         ],
//     },
//     {
//         section: "Supply & Production",
//         links: [
//             { label: "US Production Overview", href: "/supply-production/us-production-overview" },
//             { label: "US Plant Level Insights", href: "/supply-production/us-plant-insights" },
//             { label: "Global Cement Volumes", href: "/supply-production/global-cement-volumes" },
//         ],
//     },
//     {
//         section: "Business Performance",
//         links: [
//             { label: "KPIs", href: "/business-performance/kpis" },
//             { label: "Profit Pools", href: "/business-performance/profit-pools" },
//         ],
//     },
//     {
//         section: "Stock & Valuation",
//         links: [
//             { label: "Stock Price Overview", href: "/stock-valuation/stock-price-overview" },
//             { label: "Analyst Section", href: "/stock-valuation/analyst-section" },
//         ],
//     },
// ];

// export default function Footer() {
//     return (
//         <>
//             <style>{`
//         /* ── All colors use var(--bain-*) from globals.css ── */

//         .site-footer {
//           border-top: 1px solid var(--bain-gray-100);
//           padding: 24px 0 16px;
//           margin-top: 15px;
//           font-family: Arial, Helvetica, sans-serif;
//         }

//         .footer-inner {
//           max-width: 1600px;
//           margin: 0 auto;
//           padding: 0 20px;
//         }

//         /* ── Top grid ───────────────────────────────────────── */
//         .footer-top {
//           display: grid;
//           grid-template-columns: 1.6fr repeat(4, 1fr);
//           gap: 32px;
//         }
//         @media (max-width: 1024px) { .footer-top { grid-template-columns: 1fr 1fr; } }
//         @media (max-width: 640px)  { .footer-top { grid-template-columns: 1fr; } }

//         /* ── Brand column ───────────────────────────────────── */
//         .footer-logo-badge {
//           display: inline-block;
//           background: var(--bain-red);
//           color: white;
//           font-size: 13px;
//           font-weight: 700;
//           padding: 4px 10px;
//           border-radius: 6px;
//           margin-bottom: 12px;
//           letter-spacing: 0.02em;
//         }
//         .footer-tagline {
//           font-size: 13px;
//           color: var(--bain-gray);
//           line-height: 1.65;
//           max-width: 240px;
//           margin-bottom: 16px;
//         }
//         .footer-bain-logos {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//         }
//         .footer-bain-logo {
//           height: 36px;
//           width: auto;
//           object-fit: contain;
//           opacity: 1;
//           transition: opacity 0.15s, filter 0.15s;
//         }

//         /* ── Data sources row ───────────────────────────────── */
//         .footer-sources {
//           display: flex;
//           flex-wrap: wrap;
//           gap: 6px;
//           margin-top: 4px;
//         }
//         .footer-source-chip {
//           display: inline-flex;
//           flex-direction: column;
//           align-items: center;
//           gap: 1px;
//           padding: 5px 9px;
//           background: white;
//           border: 1px solid var(--bain-gray-100);
//           border-radius: 7px;
//           transition: border-color 0.15s;
//           text-align: center;
//           min-width: 72px;
//         }
//         .footer-source-chip:hover { border-color: var(--bain-red); }
//         .footer-source-name {
//           font-size: 11px;
//           font-weight: 800;
//           color: #0f172a;
//           letter-spacing: -0.1px;
//           white-space: nowrap;
//         }
//         .footer-source-desc {
//           font-size: 9.5px;
//           color: var(--bain-gray);
//           font-weight: 400;
//           white-space: nowrap;
//         }

//         /* ── Nav link columns ───────────────────────────────── */
//         .footer-col-title {
//           font-size: 11px;
//           font-weight: 700;
//           color: #0f172a;
//           text-transform: uppercase;
//           letter-spacing: 0.07em;
//           margin-bottom: 10px;
//         }
//         .footer-links {
//           display: flex;
//           flex-direction: column;
//           gap: 8px;
//         }
//         .footer-link {
//           font-size: 13px;
//           color: var(--bain-gray);
//           text-decoration: none;
//           transition: color 0.12s;
//           font-weight: 400;
//         }
//         .footer-link:hover { color: var(--bain-red); }

//         /* ── Bottom bar ─────────────────────────────────────── */
//         .footer-bottom {
//           display: flex;
//           align-items: center;
//           justify-content: space-between;
//           padding-top: 20px;
//           border-top: 1px solid var(--bain-gray-100);
//           gap: 16px;
//           flex-wrap: wrap;
//         }
//         .footer-copy {
//           font-size: 11.5px;
//           color: var(--bain-gray);
//         }
//         .footer-meta {
//           display: flex;
//           align-items: center;
//           gap: 16px;
//           flex-wrap: wrap;
//         }
//         .footer-meta-chip {
//           display: flex;
//           align-items: center;
//           gap: 5px;
//           font-size: 11px;
//           color: var(--bain-gray);
//           font-weight: 500;
//         }
//         .footer-meta-dot {
//           width: 5px;
//           height: 5px;
//           border-radius: 50%;
//           background: #22c55e;
//         }
//         .footer-meta-sep {
//           color: var(--bain-gray-200);
//           font-size: 13px;
//         }
//       `}</style>

//             <footer className="site-footer">
//                 <div className="footer-inner">

//                     {/* ── Top section ─────────────────────────────────── */}
//                     <div className="footer-top">

//                         {/* Brand + sources */}
//                         <div>
//                             <div className="footer-logo-badge">CemIQ</div>
//                             <p className="footer-tagline">
//                                 Cement and construction intelligence platform built by Bain &amp; BCN.
//                                 Data-driven insights for the global cement industry.
//                             </p>

//                             {/* Logos */}
//                             <div className="footer-bain-logos">
//                                 {/* eslint-disable-next-line @next/next/no-img-element */}
//                                 <img src="/bainlogo.png" alt="Bain" className="footer-bain-logo"
//                                     onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                                 {/* eslint-disable-next-line @next/next/no-img-element */}
//                                 <img src="/bcnlogo.png" alt="BCN" className="footer-bain-logo"
//                                     onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                             </div>

//                         </div>

//                         {/* Nav columns */}
//                         {NAV_LINKS.map((col) => (
//                             <div key={col.section}>
//                                 <div className="footer-col-title">{col.section}</div>
//                                 <div className="footer-links">
//                                     {col.links.map((l) => (
//                                         <Link key={l.href} href={l.href} className="footer-link">
//                                             {l.label}
//                                         </Link>
//                                     ))}
//                                 </div>
//                             </div>
//                         ))}
//                     </div>
//                 </div>
//             </footer>
//         </>
//     );
// }








// PATH: frontend/components/layout/Footer.tsx
"use client";
import Link from "next/link";

const NAV_LINKS = [
    {
        section: "Market Intelligence",
        links: [
            { label: "Construction Overall", href: "/market-intelligence/construction-overall" },
            { label: "Building Materials Sales", href: "/market-intelligence/building-materials" },
            { label: "Cement Sales", href: "/market-intelligence/cement-sales" },
            { label: "Cement Demand", href: "/market-intelligence/cement-demand" },
            { label: "Executive Summary", href: "/market-intelligence/executive-summary" },
        ],
    },
    {
        section: "Supply & Production",
        links: [
            { label: "US Production Overview", href: "/supply-production/us-production-overview" },
            { label: "US Plant Level Insights", href: "/supply-production/us-plant-insights" },
            { label: "Global Cement Volumes", href: "/supply-production/global-cement-volumes" },
        ],
    },
    {
        section: "Business Performance",
        links: [
            { label: "KPIs", href: "/business-performance/kpis" },
            { label: "Profit Pools", href: "/business-performance/profit-pools" },
        ],
    },
    {
        section: "Stock & Valuation",
        links: [
            { label: "Stock Price Overview", href: "/stock-valuation/stock-price-overview" },
            { label: "Analyst Section", href: "/stock-valuation/analyst-section" },
        ],
    },
    {
        section: "Cement Specific",
        links: [
            { label: "Capacity Concentration", href: "/cement-specific/capacity-concentration" },
        ],
    },
];

export default function Footer() {
    return (
        <>
            <style>{`
        /* ── All colors use var(--bain-*) from globals.css ── */

        .site-footer {
          border-top: 1px solid var(--bain-gray-100);
          padding: 24px 0 16px;
          margin-top: 15px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .footer-inner {
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* ── Top grid ───────────────────────────────────────── */
        .footer-top {
          display: grid;
          grid-template-columns: 1.6fr repeat(5, 1fr);
          gap: 32px;
        }
        @media (max-width: 1024px) { .footer-top { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 640px)  { .footer-top { grid-template-columns: 1fr; } }

        /* ── Brand column ───────────────────────────────────── */
        .footer-logo-badge {
          display: inline-block;
          background: var(--bain-red);
          color: white;
          font-size: 13px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          margin-bottom: 12px;
          letter-spacing: 0.02em;
        }
        .footer-tagline {
          font-size: 13px;
          color: var(--bain-gray);
          line-height: 1.65;
          max-width: 240px;
          margin-bottom: 16px;
        }
        .footer-bain-logos {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .footer-bain-logo {
          height: 36px;
          width: auto;
          object-fit: contain;
          opacity: 1;
          transition: opacity 0.15s, filter 0.15s;
        }

        /* ── Data sources row ───────────────────────────────── */
        .footer-sources {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }
        .footer-source-chip {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          padding: 5px 9px;
          background: white;
          border: 1px solid var(--bain-gray-100);
          border-radius: 7px;
          transition: border-color 0.15s;
          text-align: center;
          min-width: 72px;
        }
        .footer-source-chip:hover { border-color: var(--bain-red); }
        .footer-source-name {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.1px;
          white-space: nowrap;
        }
        .footer-source-desc {
          font-size: 9.5px;
          color: var(--bain-gray);
          font-weight: 400;
          white-space: nowrap;
        }

        /* ── Nav link columns ───────────────────────────────── */
        .footer-col-title {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 10px;
        }
        .footer-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .footer-link {
          font-size: 13px;
          color: var(--bain-gray);
          text-decoration: none;
          transition: color 0.12s;
          font-weight: 400;
        }
        .footer-link:hover { color: var(--bain-red); }

        /* ── Bottom bar ─────────────────────────────────────── */
        .footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 20px;
          border-top: 1px solid var(--bain-gray-100);
          gap: 16px;
          flex-wrap: wrap;
        }
        .footer-copy {
          font-size: 11.5px;
          color: var(--bain-gray);
        }
        .footer-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .footer-meta-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--bain-gray);
          font-weight: 500;
        }
        .footer-meta-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #22c55e;
        }
        .footer-meta-sep {
          color: var(--bain-gray-200);
          font-size: 13px;
        }
      `}</style>

            <footer className="site-footer">
                <div className="footer-inner">

                    {/* ── Top section ─────────────────────────────────── */}
                    <div className="footer-top">

                        {/* Brand + sources */}
                        <div>
                            <div className="footer-logo-badge">CemIQ</div>
                            <p className="footer-tagline">
                                Cement and construction intelligence platform built by Bain &amp; BCN.
                                Data-driven insights for the global cement industry.
                            </p>

                            {/* Logos */}
                            <div className="footer-bain-logos">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/bainlogo.png" alt="Bain" className="footer-bain-logo"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/bcnlogo.png" alt="BCN" className="footer-bain-logo"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                        </div>

                        {/* Nav columns */}
                        {NAV_LINKS.map((col) => (
                            <div key={col.section}>
                                <div className="footer-col-title">{col.section}</div>
                                <div className="footer-links">
                                    {col.links.map((l) => (
                                        <Link key={l.href} href={l.href} className="footer-link">
                                            {l.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </footer>
        </>
    );
}