export type DiffStatus = "igual" | "diferente" | "somente_arquivo_a" | "somente_arquivo_b";

export type DiffRow = {
  linha: number;
  status: DiffStatus;
  conteudoA: string;
  conteudoB: string;
};

export type Summary = {
  total: number;
  iguais: number;
  diferentes: number;
  somenteA: number;
  somenteB: number;
  percentualDivergencia: number;
};

export function normalizeRows(rows: string[][]): string[][] {
  return rows
    .filter((row) => row.some((col) => String(col ?? "").trim() !== ""))
    .map((row) => row.map((col) => String(col ?? "").trim()));
}

function rowToText(row: string[]): string {
  return row.join(" | ");
}

export function compareRows(rowsA: string[][], rowsB: string[][]): DiffRow[] {
  const max = Math.max(rowsA.length, rowsB.length);
  const result: DiffRow[] = [];

  for (let i = 0; i < max; i += 1) {
    const a = rowsA[i];
    const b = rowsB[i];

    if (a && b) {
      const isEqual = JSON.stringify(a) === JSON.stringify(b);
      result.push({
        linha: i + 1,
        status: isEqual ? "igual" : "diferente",
        conteudoA: rowToText(a),
        conteudoB: rowToText(b)
      });
      continue;
    }

    if (a) {
      result.push({
        linha: i + 1,
        status: "somente_arquivo_a",
        conteudoA: rowToText(a),
        conteudoB: ""
      });
      continue;
    }

    result.push({
      linha: i + 1,
      status: "somente_arquivo_b",
      conteudoA: "",
      conteudoB: rowToText(b ?? [])
    });
  }

  return result;
}

export function buildSummary(diffs: DiffRow[]): Summary {
  const total = diffs.length;
  const iguais = diffs.filter((d) => d.status === "igual").length;
  const diferentes = diffs.filter((d) => d.status === "diferente").length;
  const somenteA = diffs.filter((d) => d.status === "somente_arquivo_a").length;
  const somenteB = diffs.filter((d) => d.status === "somente_arquivo_b").length;
  const percentualDivergencia =
    total === 0 ? 0 : Number((((diferentes + somenteA + somenteB) / total) * 100).toFixed(2));

  return { total, iguais, diferentes, somenteA, somenteB, percentualDivergencia };
}

export function toCsv(diffs: DiffRow[]): string {
  const header = "linha,status,conteudoA,conteudoB";
  const rows = diffs.map((d) => {
    const safeA = `"${d.conteudoA.replaceAll('"', '""')}"`;
    const safeB = `"${d.conteudoB.replaceAll('"', '""')}"`;
    return `${d.linha},${d.status},${safeA},${safeB}`;
  });
  return [header, ...rows].join("\n");
}
