import { DiffRow } from "@/lib/depara";

type DiffTableProps = {
  rows: DiffRow[];
};

const statusClassMap: Record<DiffRow["status"], string> = {
  igual: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  diferente: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  somente_arquivo_a: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  somente_arquivo_b: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
};

const rowClassMap: Record<DiffRow["status"], string> = {
  igual: "bg-emerald-50/70 dark:bg-emerald-950/40",
  diferente: "bg-red-50/70 dark:bg-red-950/40",
  somente_arquivo_a: "bg-red-50/70 dark:bg-red-950/40",
  somente_arquivo_b: "bg-red-50/70 dark:bg-red-950/40"
};

export function DiffTable({ rows }: DiffTableProps) {
  if (!rows.length) {
    return <p className="surface-card rounded-xl p-4 muted-text">Nenhum registro para exibir.</p>;
  }

  return (
    <div className="surface-card overflow-auto rounded-2xl">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100/80 text-left text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <tr>
            <th className="px-3 py-2">Linha</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Arquivo A</th>
            <th className="px-3 py-2">Arquivo B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              id={`linha-${row.linha}`}
              key={`${row.linha}-${row.status}`}
              className={`border-t border-slate-200/80 dark:border-slate-800 ${rowClassMap[row.status]}`}
            >
              <td className="px-3 py-2 align-top font-medium">{row.linha}</td>
              <td className="px-3 py-2 align-top">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassMap[row.status]}`}>
                  {row.status !== "igual" ? `\u2192 ${row.status}` : row.status}
                </span>
              </td>
              <td className="max-w-[340px] px-3 py-2 align-top break-words text-slate-700 dark:text-slate-200">{row.conteudoA}</td>
              <td className="max-w-[340px] px-3 py-2 align-top break-words text-slate-700 dark:text-slate-200">{row.conteudoB}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
