// PATH: frontend/app/market-intelligence/building-materials/page.tsx
"use client";
import CategoryPage from "@/components/charts/CategoryPage";
export default function BuildingMaterialsPage() {
  return <CategoryPage category="Building Products Overall Sales" source="IHS Markit" />;
}