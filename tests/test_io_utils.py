from __future__ import annotations

from io import BytesIO

import pytest

from app.io_utils import read_csv_robust, validate_csv_file


class UploadStub(BytesIO):
    def __init__(self, content: bytes, name: str):
        super().__init__(content)
        self.name = name

    def getvalue(self) -> bytes:
        return super().getvalue()


def test_validate_csv_file_requires_csv_suffix() -> None:
    file_stub = UploadStub(b"col1,col2\n1,2\n", "arquivo.txt")
    with pytest.raises(ValueError, match="deve ter sufixo .csv"):
        validate_csv_file(file_stub, "Arquivo A")


def test_read_csv_robust_with_utf8_and_comma() -> None:
    file_stub = UploadStub("nome,valor\n Joao , 10 \n".encode("utf-8"), "a.csv")
    result = read_csv_robust(file_stub)
    assert result.encoding == "utf-8"
    assert result.delimiter == ","
    assert result.dataframe.iloc[0]["nome"] == "Joao"
    assert result.dataframe.iloc[0]["valor"] == "10"


def test_read_csv_robust_fallback_latin1() -> None:
    file_stub = UploadStub("nome;cidade\nJosé;São Paulo\n".encode("latin-1"), "b.csv")
    result = read_csv_robust(file_stub)
    assert result.encoding == "latin-1"
    assert result.delimiter == ";"
    assert result.dataframe.iloc[0]["nome"] == "Jos\u00e9"
