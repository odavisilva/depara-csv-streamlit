"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { DiffTable } from "@/components/DiffTable";
import { KpiCard } from "@/components/KpiCard";
import {
  buildSummary,
  compareTablesByFields,
  DiffRow,
  DiffStatus,
  tableFromMatrix,
  toCsv
} from "@/lib/depara";

const DEFAULT_FILTERS: DiffStatus[] = ["diferente", "somente_arquivo_a", "somente_arquivo_b", "igual"];
type Theme = "light" | "dark";

function hasSupportedSuffix(file: File | null): boolean {
  if (!file) return false;
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".csv") || fileName.endsWith(".xlsx");
}

function getFileSuffix(file: File): "csv" | "xlsx" | null {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".csv")) return "csv";
  if (fileName.endsWith(".xlsx")) return "xlsx";
  return null;
}

type WorkbookLike = { sheets: Map<string, string[][]> };

function basenameWithoutExt(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

function decodeCsvText(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const looksBroken = utf8.includes("\uFFFD") || /Ã.|Â.|�/.test(utf8);
  if (!looksBroken) return utf8;
  // fallback comum para arquivos gerados no Windows/ERP
  return new TextDecoder("windows-1252", { fatal: false }).decode(bytes);
}

async function parseCsvRobust(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const text = decodeCsvText(buffer);
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      delimiter: "",
      skipEmptyLines: false,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }
        resolve((results.data as string[][]) ?? []);
      },
      error: (error: unknown) => reject(error)
    });
  });
}

async function parseXlsxAllSheets(file: File): Promise<WorkbookLike> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets = new Map<string, string[][]>();
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: ""
    });
    sheets.set(sheetName, rows.map((row) => row.map((cell) => String(cell ?? ""))));
  }
  return { sheets };
}

async function parseFileToWorkbookLike(file: File): Promise<WorkbookLike> {
  const suffix = getFileSuffix(file);
  if (suffix === "csv") {
    const matrix = await parseCsvRobust(file);
    return { sheets: new Map([[basenameWithoutExt(file.name), matrix]]) };
  }
  if (suffix === "xlsx") return parseXlsxAllSheets(file);
  throw new Error("Formato nao suportado. Use .csv ou .xlsx");
}

export default function Page() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [draggingA, setDraggingA] = useState(false);
  const [draggingB, setDraggingB] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [diffs, setDiffs] = useState<DiffRow[]>([]);
  const [filters, setFilters] = useState<DiffStatus[]>(DEFAULT_FILTERS);
  const [sheetsA, setSheetsA] = useState<string[]>([]);
  const [sheetsB, setSheetsB] = useState<string[]>([]);
  const [sheetSelected, setSheetSelected] = useState<string>("");
  const [columnsA, setColumnsA] = useState<string[]>([]);
  const [columnsB, setColumnsB] = useState<string[]>([]);
  const [columnsOnlyA, setColumnsOnlyA] = useState<string[]>([]);
  const [columnsOnlyB, setColumnsOnlyB] = useState<string[]>([]);
  const [keyColumns, setKeyColumns] = useState<string[]>([]);

  const summary = useMemo(() => buildSummary(diffs), [diffs]);

  const filteredRows = useMemo(() => {
    if (!filters.length) return [];
    return diffs.filter((diff) => filters.includes(diff.status));
  }, [diffs, filters]);
  const errorRows = useMemo(
    () => diffs.filter((row) => row.status !== "igual"),
    [diffs]
  );
  const csvOutput = useMemo(() => toCsv(filteredRows), [filteredRows]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme") as Theme | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme: Theme = storedTheme ?? (systemPrefersDark ? "dark" : "light");

    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }

  async function handleCompare() {
    setError("");
    setDiffs([]);
    setSheetsA([]);
    setSheetsB([]);
    setColumnsA([]);
    setColumnsB([]);
    setColumnsOnlyA([]);
    setColumnsOnlyB([]);

    if (!hasSupportedSuffix(fileA) || !hasSupportedSuffix(fileB)) {
      setError("Envie dois arquivos nos formatos .csv ou .xlsx.");
      return;
    }

    try {
      setLoading(true);
      const [wbA, wbB] = await Promise.all([
        parseFileToWorkbookLike(fileA as File),
        parseFileToWorkbookLike(fileB as File)
      ]);

      const listA = Array.from(wbA.sheets.keys());
      const listB = Array.from(wbB.sheets.keys());
      setSheetsA(listA);
      setSheetsB(listB);

      // regra: XLSX vs XLSX -> parear por nome; caso não haja interseção, escolher a 1ª de cada
      const intersection = listA.filter((name) => listB.includes(name));
      const defaultSheet = intersection[0] ?? listA[0] ?? "";
      setSheetSelected(defaultSheet);

      const matrixA = wbA.sheets.get(defaultSheet) ?? wbA.sheets.get(listA[0] ?? "") ?? [];
      const matrixB = wbB.sheets.get(defaultSheet) ?? wbB.sheets.get(listB[0] ?? "") ?? [];

      const tableA = tableFromMatrix(matrixA);
      const tableB = tableFromMatrix(matrixB);
      setColumnsA(tableA.header);
      setColumnsB(tableB.header);

      // sugestão simples de chave (colunas com "nr_" ou "id" ou "codigo")
      const candidates = tableA.header.filter((h) => /(^nr_|id$|codigo|seq)/i.test(h));
      const initialKey = candidates.slice(0, 3);
      setKeyColumns(initialKey);

      const compared = compareTablesByFields(tableA, tableB, initialKey);
      setColumnsOnlyA(compared.columnsOnlyA);
      setColumnsOnlyB(compared.columnsOnlyB);
      setDiffs(compared.diffs);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao comparar os CSVs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function onSelectA(event: ChangeEvent<HTMLInputElement>) {
    setFileA(event.target.files?.[0] ?? null);
  }

  function onSelectB(event: ChangeEvent<HTMLInputElement>) {
    setFileB(event.target.files?.[0] ?? null);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDropA(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDraggingA(false);
    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    setFileA(droppedFile);
  }

  function onDropB(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDraggingB(false);
    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    setFileB(droppedFile);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10">
      <div className="surface-card mb-8 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-sky-500/15 to-violet-500/20 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 inline-block rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-200">
              Magic UI Style
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Depara CSV</h1>
            <p className="mt-2 muted-text">Compare dois CSVs e visualize divergencias com destaque imediato.</p>
          </div>
          <button
            onClick={toggleTheme}
            disabled={!mounted}
            className="rounded-xl border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <label
          className={`surface-card rounded-2xl p-4 transition ${
            draggingA ? "border-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-900/50" : ""
          }`}
        >
          <span className="mb-2 block text-sm font-medium muted-text">Arquivo A (.csv ou .xlsx)</span>
          <div
            onDragOver={onDragOver}
            onDragEnter={() => setDraggingA(true)}
            onDragLeave={() => setDraggingA(false)}
            onDrop={onDropA}
            className="mb-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-5 text-center text-sm muted-text dark:border-slate-700 dark:bg-slate-900/50"
          >
            Arraste e solte o arquivo aqui
          </div>
          {fileA && <p className="mb-2 text-xs muted-text">Selecionado: {fileA.name}</p>}
          <input type="file" accept=".csv,.xlsx" onChange={onSelectA} className="block w-full text-sm" />
        </label>
        <label
          className={`surface-card rounded-2xl p-4 transition ${
            draggingB ? "border-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-900/50" : ""
          }`}
        >
          <span className="mb-2 block text-sm font-medium muted-text">Arquivo B (.csv ou .xlsx)</span>
          <div
            onDragOver={onDragOver}
            onDragEnter={() => setDraggingB(true)}
            onDragLeave={() => setDraggingB(false)}
            onDrop={onDropB}
            className="mb-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-5 text-center text-sm muted-text dark:border-slate-700 dark:bg-slate-900/50"
          >
            Arraste e solte o arquivo aqui
          </div>
          {fileB && <p className="mb-2 text-xs muted-text">Selecionado: {fileB.name}</p>}
          <input type="file" accept=".csv,.xlsx" onChange={onSelectB} className="block w-full text-sm" />
        </label>
      </section>

      {(sheetsA.length > 1 || sheetsB.length > 1) && (
        <section className="surface-card mt-6 rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-semibold">Abas (XLSX)</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium muted-text">Abas no arquivo A</p>
              <p className="text-sm muted-text">{sheetsA.join(", ") || "-"}</p>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium muted-text">Abas no arquivo B</p>
              <p className="text-sm muted-text">{sheetsB.join(", ") || "-"}</p>
            </div>
          </div>
          {!!sheetSelected && (
            <p className="mt-3 text-sm muted-text">
              Comparando aba: <span className="font-semibold">{sheetSelected}</span> (por nome quando existir nos dois)
            </p>
          )}
        </section>
      )}

      {(columnsA.length > 0 || columnsB.length > 0) && (
        <section className="surface-card mt-6 rounded-2xl p-5">
          <h2 className="mb-3 text-lg font-semibold">Validação de campos</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium muted-text">Colunas somente no A</p>
              <p className="text-sm muted-text">{columnsOnlyA.join(", ") || "Nenhuma"}</p>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium muted-text">Colunas somente no B</p>
              <p className="text-sm muted-text">{columnsOnlyB.join(", ") || "Nenhuma"}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium muted-text">Chave de comparação (opcional)</p>
            <p className="text-sm muted-text">
              Atual: <span className="font-semibold">{keyColumns.join(" + ") || "por índice (linha)"}</span>
            </p>
            <p className="mt-1 text-xs muted-text">
              Se a ordem dos arquivos for diferente, definir chave melhora muito a coerência.
            </p>
          </div>
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={handleCompare}
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Comparando..." : "Comparar"}
        </button>

        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvOutput)}`}
          download="depara_diferencas.csv"
          className="rounded-xl border border-slate-300 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Exportar CSV filtrado
        </a>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Total comparado" value={summary.total} tone="default" />
        <KpiCard title="Iguais" value={summary.iguais} tone="ok" />
        <KpiCard title="Diferentes" value={summary.diferentes} tone="warn" />
        <KpiCard title="Somente A" value={summary.somenteA} tone="warn" />
        <KpiCard title="% Divergencia" value={`${summary.percentualDivergencia}%`} tone="default" />
      </section>

      <section className="surface-card mt-8 rounded-2xl p-5">
        <h2 className="mb-3 text-lg font-semibold">Filtros</h2>
        <div className="flex flex-wrap gap-2">
          {(["diferente", "somente_arquivo_a", "somente_arquivo_b", "igual"] as DiffStatus[]).map((status) => {
            const selected = filters.includes(status);
            return (
              <button
                key={status}
                onClick={() =>
                  setFilters((prev) =>
                    prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
                  )
                }
                className={`rounded-full px-3 py-1 text-sm transition ${
                  selected
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      </section>

      {!!errorRows.length && (
        <section className="surface-card mt-6 rounded-2xl border-red-300/70 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/20">
          <h2 className="mb-3 text-lg font-semibold text-red-800 dark:text-red-200">Setas para erros</h2>
          <div className="flex flex-wrap gap-2">
            {errorRows.map((row) => (
              <a
                key={`erro-${row.linha}-${row.status}`}
                href={`#linha-${row.linha}`}
                className="rounded-full border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-slate-800"
              >
                {`\u2192 Linha ${row.linha} (${row.status})`}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Detalhamento completo (todos os dados)</h2>
        <DiffTable rows={filteredRows} />
      </section>
    </main>
  );
}
