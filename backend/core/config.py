"""
core/config.py
Centralised settings loaded from .env via pydantic-settings.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── OpenAI ────────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4.1"
    OPENAI_EXEC_OUTLOOK_MODEL: str = "gpt-4.1-mini"
    OPENAI_SLIDE_POLISH_MODEL: str = "gpt-4.1"
    OPENAI_WEB_MODEL: str = "gpt-4.1"

    # ── Paths ─────────────────────────────────────────────────────────────────
    DATA_DIR: Path = Path("./data")
    TEMPLATES_DIR: Path = Path("./data/templates")

    # ── Excel filenames (relative to DATA_DIR) ────────────────────────────────
    FLAT_FILE_NAME: str = "Construction_Cement_FlatFile.xlsx"
    GLOBAL_CEMENT_NAME: str = "global_cement_metrics.xlsx"
    PROFIT_POOL_NAME: str = "Profit_Pool.xlsx"
    CIQ_FINANCIALS_NAME: str = "TBD_CIQ_Company financials_01282026_final.xlsx"
    STOCK_PRICES_NAME: str = "TBD_CIQ_Company financials_01282026_stock_prices.xlsx"
    US_CAPACITY_NAME: str = "US Cement capacity_with FULL lat long.xlsx"
    CONSTRUCTION_DETAIL_NAME: str = "Construction_Detail.xlsx"
    CEMENT_CONCENTRATION_NAME: str = "Global-Cement-and-Concrete-Tracker_July-2025.xlsx"

    # ── Think-cell ────────────────────────────────────────────────────────────
    THINKCELL_SERVER_URL: str = "http://127.0.0.1:8080/"
    THINKCELL_TEMPLATE_MEKKO: Path = Path("./data/templates/thinkcell_template_mekko.pptx")
    THINKCELL_TEMPLATE_GROWTH: Path = Path("./data/templates/thinkcell_template_growth_new.pptx")
    THINKCELL_TEMPLATE_GROWTH_OLD: Path = Path("./data/templates/thinkcell_template_growth.pptx")
    THINKCELL_TEMPLATE_BAR: Path = Path("./data/templates/THINKCELL_TEMPLATE_BAR.pptx")
    THINKCELL_TEMPLATE_BUBBLE: Path = Path("./data/templates/THINKCELL_TEMPLATE_BUBBLE.pptx")
    THINKCELL_TEMPLATE_CATEGORY: Path = Path("./data/templates/THINKCELL_TEMPLATE_CATEGORY.pptx")
    THINKCELL_TEMPLATE_GROWTH_S2: Path = Path("./data/templates/template_construction_overall.pptx")
    THINKCELL_TEMPLATE_GROWTH_S3: Path = Path("./data/templates/template_building_sales.pptx")
    THINKCELL_TEMPLATE_GROWTH_S4: Path = Path("./data/templates/template_cement_sales.pptx")
    THINKCELL_TEMPLATE_MEKKO_RMS: Path = Path("./data/templates/thinkcell_template_mekko_rms.pptx")

    # ── Think-cell element names ───────────────────────────────────────────────
    TC_ELEM_MEKKO: str = "MekkoChart"
    TC_ELEM_GROWTH: str = "GrowthChart"
    TC_ELEM_TITLE: str = "ChartTitle"
    TC_ELEM_BAR: str = "BarChart"
    TC_ELEM_CATEGORY: str = "CategoryChart"

    # ── Exec summary cache ────────────────────────────────────────────────────
    EXEC_OUTLOOK_REASON_CACHE_DIR: str = "./.exec_outlook_reason_cache"
    EXEC_OUTLOOK_REASON_CACHE_TTL_SECONDS: int = 604800  # 7 days

    # ── App ───────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://10.42.114.35:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    # ── Convenience properties ────────────────────────────────────────────────
    @property
    def flat_file_path(self) -> Path:
        return self.DATA_DIR / self.FLAT_FILE_NAME

    @property
    def global_cement_path(self) -> Path:
        return self.DATA_DIR / self.GLOBAL_CEMENT_NAME

    @property
    def profit_pool_path(self) -> Path:
        return self.DATA_DIR / self.PROFIT_POOL_NAME

    @property
    def ciq_financials_path(self) -> Path:
        return self.DATA_DIR / self.CIQ_FINANCIALS_NAME

    @property
    def stock_prices_path(self) -> Path:
        return self.DATA_DIR / self.STOCK_PRICES_NAME

    @property
    def us_capacity_path(self) -> Path:
        return self.DATA_DIR / self.US_CAPACITY_NAME

    @property
    def construction_detail_path(self) -> Path:
        return self.DATA_DIR / self.CONSTRUCTION_DETAIL_NAME

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()