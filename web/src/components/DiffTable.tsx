import { DiffRow } from "@/lib/depara";

type DiffTableProps = {
  rows: DiffRow[];
};

const statusClassMap: Record<DiffRow["status"], string> = {
  igual: "bg-emerald-50 text-emerald-700",
  diferente: "bg-amber-50 text-amber-700",
  somente_arquivo_a: "bg-blue-50 text-blue-700",
  somente_arquivo_b: "bg-violet-50 text-violet-700"
};

export function DiffTable({ rows }: DiffTableProps) {
  if (!rows.length) {
    return <p className="rounded-xl bg-white p-4 text-slate-500 shadow-sm">Nenhum registro para exibir.</p>;
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2">Linha</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Arquivo A</th>
            <th className="px-3 py-2">Arquivo B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.linha}-${row.status}`} className="border-t border-slate-100">
              <td className="px-3 py-2 align-top text-slate-700">{row.linha}</td>
              <td className="px-3 py-2 align-top">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassMap[row.status]}`}>
                  {row.status}
                </span>
              </td>
              <td className="max-w-[340px] px-3 py-2 align-top text-slate-700">{row.conteudoA}</td>
              <td className="max-w-[340px] px-3 py-2 align-top text-slate-700">{row.conteudoB}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
