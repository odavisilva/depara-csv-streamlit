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

export function tableFromMatrix(matrix: string[][]): Table {
  const normalized = normalizeRows(matrix);
  const headerRow = normalized[0] ?? [];
  const header = headerRow.map((h) => normalizeHeaderCell(String(h ?? ""))).filter((h) => h !== "");

  const rows = normalized.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = normalizeValue(row[i] ?? "");
    }
    return obj;
  });
  return { header, rows };
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
