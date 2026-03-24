from __future__ import annotations

from io import StringIO

import pandas as pd


def filter_differences(diff_df: pd.DataFrame, status_filters: list[str]) -> pd.DataFrame:
    if not status_filters:
        return diff_df.iloc[0:0]
    return diff_df[diff_df["status"].isin(status_filters)].copy()


def dataframe_to_csv_bytes(dataframe: pd.DataFrame) -> bytes:
    buffer = StringIO()
    dataframe.to_csv(buffer, index=False)
    return buffer.getvalue().encode("utf-8")
