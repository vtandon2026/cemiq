#exec_summary/config.py
#exec_summary/Contains all the global constants

FORECAST_START = 2025
FORECAST_END   = 2029

EARLY_START = 2025
EARLY_END   = 2027

LATE_START  = 2027
LATE_END    = 2029

HIST_START  = 2014
HIST_END    = 2019

COVID_BASE  = 2019
COVID_YEARS = [2020, 2021]

# Thresholds (plain language)
ACCEL_THRESHOLD_PCT_PT = 1.0         # 1 percentage point i.e growth must increase by atleast 1% point to say it is increasing
SLOWER_THAN_REGION_PP  = 2.0         # 2 percentage points i.e country considered a drag if it grows atleast 2% less than regional growth
COMPARE_GLOBAL_PP       = 0.5         # 0.5 percentage points i.e to say something is meaningful,growth must differ by half a percentage point
COMPARE_REGION_PP       = 0.5         # 0.5 percentage points i.e regional comparison(same logic as global)

MIN_GLOBAL_SHARE_FASTEST = 0.005      # 0.5% expressed as fraction regions and countries that make atleast 0.5% of global revenue are allowed in consideration for fastest growing
SCALED_SHARE_THRESHOLD   = 0.01       # 1% expressed as fraction if it contains atleast 1% of global revenue 
TOP3_CONCENTRATION       = 0.60       # 60% if top 3 countries account for more than  or equal to 60% of regional revenue
HIGH_GROWTH_PERCENTILE   = 0.75       # 75th percentile country considered high growth  if its forecast growth rate is in the top 25% globally

EXEC_SUMMARY_SERIES = {}
# Note: Category is selected via UI filters (not hard-coded here).

# =========================
# Executive Outlook (NEW)
# =========================
# Country vs Region CAGR delta bands (percentage points)
# These are used for classification + natural language.
# Example: delta_pp = (country_cagr - region_cagr) * 100
CAGR_DELTA_STABLE_LOW_PP = -0.5
CAGR_DELTA_STABLE_HIGH_PP = 0.5

CAGR_DELTA_MODERATE_GROWTH_HIGH_PP = 4.0     # +0.5pp to +4.0pp
CAGR_DELTA_MODERATE_FALL_LOW_PP = -4.0       # -0.5pp to -4.0pp

# Labels are rendered in natural language; these strings are for internal use
LABEL_STABLE = "Stable"
LABEL_MODERATE_GROWTH = "Moderate growth"
LABEL_STRONG_GROWTH = "Strong growth"
LABEL_MODERATE_UNDERPERFORMANCE = "Moderate underperformance"
LABEL_MATERIAL_UNDERPERFORMANCE = "Material underperformance"