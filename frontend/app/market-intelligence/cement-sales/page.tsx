// PATH: frontend/app/market-intelligence/cement-sales/page.tsx
"use client";
import CategoryPage from "@/components/charts/CategoryPage";
export default function CementSalesPage() {
  return <CategoryPage category="Cement, Concrete, Lime Overall Sales" source="IHS Markit" />;
}