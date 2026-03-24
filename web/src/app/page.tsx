"use client";

import Papa from "papaparse";
import { ChangeEvent, useMemo, useState } from "react";
import { DiffTable } from "@/components/DiffTable";
import { KpiCard } from "@/components/KpiCard";
import { buildSummary, compareRows, DiffRow, DiffStatus, normalizeRows, toCsv } from "@/lib/depara";

const DEFAULT_FILTERS: DiffStatus[] = ["diferente", "somente_arquivo_a", "somente_arquivo_b"];

function hasCsvSuffix(file: File | null): boolean {
  if (!file) return false;
  return file.name.toLowerCase().endsWith(".csv");
}

function parseCsv(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      delimiter: "",
      skipEmptyLines: false,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }
        resolve((results.data as string[][]) ?? []);
      },
      error: (error) => reject(error)
    });
  });
}

export default function Page() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [diffs, setDiffs] = useState<DiffRow[]>([]);
  const [filters, setFilters] = useState<DiffStatus[]>(DEFAULT_FILTERS);

  const summary = useMemo(() => buildSummary(diffs), [diffs]);

  const filteredRows = useMemo(() => {
    if (!filters.length) return [];
    return diffs.filter((diff) => filters.includes(diff.status));
  }, [diffs, filters]);

  async function handleCompare() {
    setError("");
    setDiffs([]);

    if (!hasCsvSuffix(fileA) || !hasCsvSuffix(fileB)) {
      setError("Envie dois arquivos com sufixo .csv.");
      return;
    }

    try {
      setLoading(true);
      const [rowsA, rowsB] = await Promise.all([parseCsv(fileA as File), parseCsv(fileB as File)]);
      const normalizedA = normalizeRows(rowsA);
      const normalizedB = normalizeRows(rowsB);
      setDiffs(compareRows(normalizedA, normalizedB));
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

  const csvOutput = useMemo(() => toCsv(filteredRows), [filteredRows]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10">
      <div className="mb-8 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-700 p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold">Depara CSV</h1>
        <p className="mt-2 text-slate-200">Compare dois CSVs e visualize as divergencias com clareza.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="mb-2 block text-sm font-medium text-slate-600">Arquivo A (.csv)</span>
          <input type="file" accept=".csv" onChange={onSelectA} className="block w-full text-sm" />
        </label>
        <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="mb-2 block text-sm font-medium text-slate-600">Arquivo B (.csv)</span>
          <input type="file" accept=".csv" onChange={onSelectB} className="block w-full text-sm" />
        </label>
      </section>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={handleCompare}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Comparando..." : "Comparar"}
        </button>

        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvOutput)}`}
          download="depara_diferencas.csv"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Exportar CSV filtrado
        </a>
      </div>

      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Total comparado" value={summary.total} />
        <KpiCard title="Iguais" value={summary.iguais} />
        <KpiCard title="Diferentes" value={summary.diferentes} />
        <KpiCard title="Somente A" value={summary.somenteA} />
        <KpiCard title="% Divergencia" value={`${summary.percentualDivergencia}%`} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Filtros</h2>
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
                  selected ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Detalhamento</h2>
        <DiffTable rows={filteredRows} />
      </section>
    </main>
  );
}
