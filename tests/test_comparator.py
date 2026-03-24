from __future__ import annotations

import pandas as pd

from app.comparator import (
    STATUS_DIFFERENT,
    STATUS_EQUAL,
    STATUS_ONLY_A,
    STATUS_ONLY_B,
    build_summary,
    compare_by_row_position,
)


def test_compare_by_row_position_classifies_rows() -> None:
    df_a = pd.DataFrame([{"id": "1", "nome": "Ana"}, {"id": "2", "nome": "Bia"}])
    df_b = pd.DataFrame([{"id": "1", "nome": "Ana"}, {"id": "2", "nome": "Bea"}, {"id": "3", "nome": "Caio"}])

    diff_df = compare_by_row_position(df_a, df_b)

    assert diff_df["status"].tolist() == [STATUS_EQUAL, STATUS_DIFFERENT, STATUS_ONLY_B]


def test_compare_by_row_position_detects_only_a() -> None:
    df_a = pd.DataFrame([{"id": "1"}, {"id": "2"}])
    df_b = pd.DataFrame([{"id": "1"}])
    diff_df = compare_by_row_position(df_a, df_b)
    assert diff_df["status"].tolist() == [STATUS_EQUAL, STATUS_ONLY_A]


def test_build_summary_counts_and_percentage() -> None:
    diff_df = pd.DataFrame(
        [
            {"status": STATUS_EQUAL},
            {"status": STATUS_DIFFERENT},
            {"status": STATUS_ONLY_A},
            {"status": STATUS_ONLY_B},
        ]
    )
    summary = build_summary(diff_df)
    assert summary["total_linhas_comparadas"] == 4
    assert summary["linhas_iguais"] == 1
    assert summary["linhas_diferentes"] == 1
    assert summary["somente_a"] == 1
    assert summary["somente_b"] == 1
    assert summary["percentual_diferenca"] == 75.0
