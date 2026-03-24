from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import csv
from typing import BinaryIO

import pandas as pd


@dataclass
class CsvReadResult:
    dataframe: pd.DataFrame
    delimiter: str
    encoding: str


def validate_csv_file(uploaded_file: BinaryIO, label: str) -> None:
    if uploaded_file is None:
        raise ValueError(f"{label} e obrigatorio.")

    file_name = getattr(uploaded_file, "name", "")
    if not file_name.lower().endswith(".csv"):
        raise ValueError(f"{label} deve ter sufixo .csv.")


def _detect_delimiter(text_sample: str) -> str:
    common_delimiters = [",", ";", "|", "\t"]
    try:
        sniffed = csv.Sniffer().sniff(text_sample, delimiters=common_delimiters)
        return sniffed.delimiter
    except csv.Error:
        return ","


def read_csv_robust(uploaded_file: BinaryIO) -> CsvReadResult:
    raw_bytes = uploaded_file.getvalue()
    if not raw_bytes:
        raise ValueError(f"Arquivo vazio: {getattr(uploaded_file, 'name', 'sem_nome')}")

    decoded_text = None
    used_encoding = ""
    for encoding in ("utf-8", "latin-1"):
        try:
            decoded_text = raw_bytes.decode(encoding)
            used_encoding = encoding
            break
        except UnicodeDecodeError:
            continue

    if decoded_text is None:
        raise ValueError("Nao foi possivel ler o arquivo com encodings suportados.")

    delimiter = _detect_delimiter(decoded_text[:5000])
    dataframe = pd.read_csv(
        BytesIO(raw_bytes),
        sep=delimiter,
        dtype=str,
        encoding=used_encoding,
        keep_default_na=False,
    )
    dataframe = normalize_dataframe(dataframe)
    return CsvReadResult(dataframe=dataframe, delimiter=delimiter, encoding=used_encoding)


def normalize_dataframe(dataframe: pd.DataFrame) -> pd.DataFrame:
    normalized = dataframe.copy()
    normalized.columns = [str(col).strip() for col in normalized.columns]
    for col in normalized.columns:
        normalized[col] = normalized[col].astype(str).str.strip()
    return normalized
