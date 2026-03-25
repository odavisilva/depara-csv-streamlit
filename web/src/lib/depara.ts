export type DiffStatus = "igual" | "diferente" | "somente_arquivo_a" | "somente_arquivo_b";

export type DiffRow = {
  linha: number;
  chave?: string;
  camposDiferentes?: string[];
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

function rowToTextByHeader(header: string[], row: Record<string, string>): string {
  return header.map((h) => `${h}=${row[h] ?? ""}`).join(" | ");
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
        conteudoA: a.join(" | "),
        conteudoB: b.join(" | ")
      });
      continue;
    }

    if (a) {
      result.push({
        linha: i + 1,
        status: "somente_arquivo_a",
        conteudoA: a.join(" | "),
        conteudoB: ""
      });
      continue;
    }

    result.push({
      linha: i + 1,
      status: "somente_arquivo_b",
      conteudoA: "",
      conteudoB: (b ?? []).join(" | ")
    });
  }

  return result;
}

export type Table = {
  header: string[];
  rows: Record<string, string>[];
};

function normalizeHeaderCell(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ");
}

function normalizeValue(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "?") return "";
  // normaliza decimais pt-BR quando vier como texto
  if (/^-?\d+,\d+$/.test(trimmed)) return trimmed.replace(",", ".");
  return trimmed;
}

function isProbablyReportTitleCell(value: string): boolean {
  const v = normalizeHeaderCell(String(value ?? ""));
  if (!v) return false;
  return /relat[oó]rio|estabelecimento|data atendimento|tipo carga|\|\< \>\|/i.test(v);
}

function scoreHeaderCandidateRow(row: string[]): number {
  const cells = row.map((c) => normalizeHeaderCell(String(c ?? "")));
  const nonEmpty = cells.filter((c) => c !== "");
  const uniqueNonEmpty = new Set(nonEmpty.map((c) => c.toLowerCase()));

  // linha de título/relatório normalmente tem 1 célula “grandona”
  const titlePenalty = nonEmpty.some((c) => isProbablyReportTitleCell(c)) ? 8 : 0;
  const oneCellPenalty = nonEmpty.length <= 1 ? 10 : 0;

  const keywordBonus = nonEmpty.filter((c) => /(^nr_|^cod_|^dt_|^hr_|id$|codigo|seq|sit_|tipo_)/i.test(c))
    .length;

  // preferir linhas com muitas colunas preenchidas e valores curtos (nomes de campo)
  const avgLen = nonEmpty.length === 0 ? 999 : nonEmpty.reduce((a, b) => a + b.length, 0) / nonEmpty.length;
  const longTextPenalty = avgLen > 35 ? 6 : avgLen > 20 ? 2 : 0;

  return (
    nonEmpty.length * 2 +
    uniqueNonEmpty.size * 3 +
    keywordBonus * 4 -
    titlePenalty -
    oneCellPenalty -
    longTextPenalty
  );
}

export function tableFromMatrix(matrix: string[][]): Table {
  const normalized = matrix.map((row) => row.map((c) => String(c ?? "")));
  const limited = normalized.slice(0, 40);

  // escolher a melhor linha de cabeçalho dentro das primeiras N linhas
  let bestIdx = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < limited.length; i += 1) {
    const score = scoreHeaderCandidateRow(limited[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // fallback: se nada prestou, usar a primeira linha mesmo
  const headerRow = (normalized[bestIdx] ?? []).map((h) => normalizeHeaderCell(String(h ?? "")));

  // manter posição das colunas (não filtrar vazios) para não “desalinha” dados
  const header = headerRow.map((h, idx) => (h === "" ? `__col_${idx + 1}` : h));

  // dados começam após o cabeçalho; remover linhas completamente vazias
  const dataRows = normalized.slice(bestIdx + 1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

  const rows = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = normalizeValue(row[i] ?? "");
    }
    return obj;
  });

  // se existir “coluna título” (tipo relatório) como __col_1 mas cabeçalho real tinha um texto grande,
  // isso ainda não quebra o diff; mas ajuda não poluir a UI removendo colunas com nome de relatório.
  const cleanedHeader = header.filter((h) => !isProbablyReportTitleCell(h));
  const cleanedRows = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const h of cleanedHeader) out[h] = r[h] ?? "";
    return out;
  });

  return { header: cleanedHeader, rows: cleanedRows };
}

export function compareTablesByFields(
  tableA: Table,
  tableB: Table,
  keyColumns: string[]
): { diffs: DiffRow[]; columnsOnlyA: string[]; columnsOnlyB: string[] } {
  const headerUnion = Array.from(new Set([...tableA.header, ...tableB.header]));
  const columnsOnlyA = tableA.header.filter((h) => !tableB.header.includes(h));
  const columnsOnlyB = tableB.header.filter((h) => !tableA.header.includes(h));

  const useKey = keyColumns.length > 0 && keyColumns.every((k) => headerUnion.includes(k));
  const makeKey = (row: Record<string, string>, index: number) => {
    if (!useKey) return `__idx__${index}`;
    return keyColumns.map((k) => `${row[k] ?? ""}`).join("||");
  };

  const mapA = new Map<string, Record<string, string>>();
  const mapB = new Map<string, Record<string, string>>();
  const seenA = new Map<string, number>();
  const seenB = new Map<string, number>();

  tableA.rows.forEach((row, idx) => {
    const base = makeKey(row, idx);
    const count = (seenA.get(base) ?? 0) + 1;
    seenA.set(base, count);
    const key = count > 1 ? `${base}__dup__${count}` : base;
    mapA.set(key, row);
  });
  tableB.rows.forEach((row, idx) => {
    const base = makeKey(row, idx);
    const count = (seenB.get(base) ?? 0) + 1;
    seenB.set(base, count);
    const key = count > 1 ? `${base}__dup__${count}` : base;
    mapB.set(key, row);
  });

  const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
  const diffs: DiffRow[] = allKeys.map((key, i) => {
    const rowA = mapA.get(key);
    const rowB = mapB.get(key);

    if (rowA && rowB) {
      const changed: string[] = [];
      for (const col of headerUnion) {
        const a = normalizeValue(rowA[col] ?? "");
        const b = normalizeValue(rowB[col] ?? "");
        if (a !== b) changed.push(col);
      }
      const status: DiffStatus = changed.length === 0 ? "igual" : "diferente";
      return {
        linha: i + 1,
        chave: useKey ? key : undefined,
        camposDiferentes: changed,
        status,
        conteudoA: rowToTextByHeader(headerUnion, rowA),
        conteudoB: rowToTextByHeader(headerUnion, rowB)
      };
    }

    if (rowA) {
      return {
        linha: i + 1,
        chave: useKey ? key : undefined,
        camposDiferentes: headerUnion,
        status: "somente_arquivo_a",
        conteudoA: rowToTextByHeader(headerUnion, rowA),
        conteudoB: ""
      };
    }

    return {
      linha: i + 1,
      chave: useKey ? key : undefined,
      camposDiferentes: headerUnion,
      status: "somente_arquivo_b",
      conteudoA: "",
      conteudoB: rowToTextByHeader(headerUnion, rowB ?? {})
    };
  });

  return { diffs, columnsOnlyA, columnsOnlyB };
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
  const header = "linha,chave,status,camposDiferentes,conteudoA,conteudoB";
  const rows = diffs.map((d) => {
    const safeKey = `"${String(d.chave ?? "").replaceAll('"', '""')}"`;
    const safeCampos = `"${(d.camposDiferentes ?? []).join("|").replaceAll('"', '""')}"`;
    const safeA = `"${d.conteudoA.replaceAll('"', '""')}"`;
    const safeB = `"${d.conteudoB.replaceAll('"', '""')}"`;
    return `${d.linha},${safeKey},${d.status},${safeCampos},${safeA},${safeB}`;
  });
  return [header, ...rows].join("\n");
}
