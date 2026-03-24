from __future__ import annotations

import json
from typing import Any

import pandas as pd


STATUS_EQUAL = "igual"
STATUS_DIFFERENT = "diferente"
STATUS_ONLY_A = "somente_arquivo_a"
STATUS_ONLY_B = "somente_arquivo_b"


def _row_to_json(row: dict[str, Any]) -> str:
    return json.dumps(row, ensure_ascii=True, sort_keys=True)


def compare_by_row_position(df_a: pd.DataFrame, df_b: pd.DataFrame) -> pd.DataFrame:
    max_rows = max(len(df_a), len(df_b))
    union_columns = list(dict.fromkeys(list(df_a.columns) + list(df_b.columns)))

    normalized_a = df_a.reindex(columns=union_columns, fill_value="")
    normalized_b = df_b.reindex(columns=union_columns, fill_value="")

    result_rows = []
    for index in range(max_rows):
        has_a = index < len(normalized_a)
        has_b = index < len(normalized_b)

        row_a = normalized_a.iloc[index].to_dict() if has_a else {}
        row_b = normalized_b.iloc[index].to_dict() if has_b else {}

        if has_a and has_b:
            status = STATUS_EQUAL if row_a == row_b else STATUS_DIFFERENT
        elif has_a:
            status = STATUS_ONLY_A
        else:
            status = STATUS_ONLY_B

        result_rows.append(
            {
                "linha": index + 1,
                "status": status,
                "conteudo_a": _row_to_json(row_a) if has_a else "",
                "conteudo_b": _row_to_json(row_b) if has_b else "",
            }
        )

    return pd.DataFrame(result_rows)


def build_summary(diff_df: pd.DataFrame) -> dict[str, float]:
    total = len(diff_df)
    if total == 0:
        return {
            "total_linhas_comparadas": 0,
            "linhas_iguais": 0,
            "linhas_diferentes": 0,
            "somente_a": 0,
            "somente_b": 0,
            "percentual_diferenca": 0.0,
        }

    iguais = int((diff_df["status"] == STATUS_EQUAL).sum())
    diferentes = int((diff_df["status"] == STATUS_DIFFERENT).sum())
    somente_a = int((diff_df["status"] == STATUS_ONLY_A).sum())
    somente_b = int((diff_df["status"] == STATUS_ONLY_B).sum())

    total_com_diferenca = diferentes + somente_a + somente_b
    percentual = round((total_com_diferenca / total) * 100, 2)

    return {
        "total_linhas_comparadas": total,
        "linhas_iguais": iguais,
        "linhas_diferentes": diferentes,
        "somente_a": somente_a,
        "somente_b": somente_b,
        "percentual_diferenca": percentual,
    }
