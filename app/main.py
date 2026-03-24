from __future__ import annotations

import streamlit as st

from app.comparator import (
    STATUS_DIFFERENT,
    STATUS_EQUAL,
    STATUS_ONLY_A,
    STATUS_ONLY_B,
    build_summary,
    compare_by_row_position,
)
from app.io_utils import read_csv_robust, validate_csv_file
from app.report import dataframe_to_csv_bytes, filter_differences


def _render_header() -> None:
    st.set_page_config(page_title="Depara CSV", page_icon=":bar_chart:", layout="wide")
    st.title("Depara CSV")
    st.caption("Compare dois arquivos CSV e veja as diferencas de forma clara.")


def _render_summary(summary: dict[str, float]) -> None:
    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("Total comparado", int(summary["total_linhas_comparadas"]))
    col2.metric("Iguais", int(summary["linhas_iguais"]))
    col3.metric("Diferentes", int(summary["linhas_diferentes"]))
    col4.metric("Somente A/B", int(summary["somente_a"] + summary["somente_b"]))
    col5.metric("% divergencia", f"{summary['percentual_diferenca']}%")


def main() -> None:
    _render_header()

    col_a, col_b = st.columns(2)
    with col_a:
        file_a = st.file_uploader("Arquivo A (.csv)", type=["csv"], key="file_a")
    with col_b:
        file_b = st.file_uploader("Arquivo B (.csv)", type=["csv"], key="file_b")

    compare_click = st.button("Comparar arquivos", type="primary")

    if not compare_click:
        st.info("Selecione dois arquivos CSV e clique em Comparar arquivos.")
        return

    try:
        validate_csv_file(file_a, "Arquivo A")
        validate_csv_file(file_b, "Arquivo B")

        read_result_a = read_csv_robust(file_a)
        read_result_b = read_csv_robust(file_b)
        diff_df = compare_by_row_position(read_result_a.dataframe, read_result_b.dataframe)
        summary = build_summary(diff_df)
    except Exception as exc:  # noqa: BLE001
        st.error(f"Falha ao processar arquivos: {exc}")
        return

    st.success(
        "Comparacao concluida "
        f"(A: {read_result_a.encoding}/{read_result_a.delimiter!r}, "
        f"B: {read_result_b.encoding}/{read_result_b.delimiter!r})."
    )

    _render_summary(summary)

    st.subheader("Filtros")
    status_options = [STATUS_DIFFERENT, STATUS_ONLY_A, STATUS_ONLY_B, STATUS_EQUAL]
    selected_status = st.multiselect(
        "Tipos de linha para exibir",
        options=status_options,
        default=[STATUS_DIFFERENT, STATUS_ONLY_A, STATUS_ONLY_B],
    )

    filtered_df = filter_differences(diff_df, selected_status)
    st.subheader("Detalhamento")
    st.dataframe(filtered_df, use_container_width=True, hide_index=True)

    report_bytes = dataframe_to_csv_bytes(filtered_df)
    st.download_button(
        "Baixar relatorio filtrado (CSV)",
        data=report_bytes,
        file_name="depara_diferencas.csv",
        mime="text/csv",
    )


if __name__ == "__main__":
    main()
