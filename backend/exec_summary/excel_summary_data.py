# exec_summary/excel_summary_data.py
#converts data into wide for the working of executive summary
import pandas as pd
from .config import EXEC_SUMMARY_SERIES

def load_exec_summary_long(path: str) -> pd.DataFrame:
    df = pd.read_excel(path)

    year_cols = [c for c in df.columns if str(c).isdigit()]
    id_cols = [c for c in df.columns if c not in year_cols]

    long_df = df.melt(
        id_vars=id_cols,
        value_vars=year_cols,
        var_name="Year",
        value_name="Revenue",
    )

    long_df["Year"] = long_df["Year"].astype(int)

    # Apply exec summary series definition
    for col, val in EXEC_SUMMARY_SERIES.items():
        if col in long_df.columns:
            long_df = long_df[long_df[col] == val]

    return long_df
