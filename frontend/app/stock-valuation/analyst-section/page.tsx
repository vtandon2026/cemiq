// PATH: frontend/app/stock-valuation/analyst-section/page.tsx
import PageHeader from "@/components/layout/PageHeader";

export default function AnalystSectionPage() {
  return (
    <div>
      <PageHeader
        title="Analyst Section"
        subtitle="Stock & Valuation · Analyst coverage and recommendations"
      />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 200, color: "#94a3b8", fontSize: 13,
        border: "1px dashed #e2e8f0", borderRadius: 10,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>
        Analyst Section — To be updated soon.
      </div>
    </div>
  );
}