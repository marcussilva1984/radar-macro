"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BalanceEntry } from "@/lib/brokerPortfolio";

const fieldClass =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function money(v: number) {
  return `$${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
}

export function EntryRow({ entry }: { entry: BalanceEntry }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [entryDate, setEntryDate] = useState(entry.entryDate.toISOString().slice(0, 10));
  const [balance, setBalance] = useState(String(entry.balance));
  const [deposit, setDeposit] = useState(String(entry.deposit));
  const [withdrawal, setWithdrawal] = useState(String(entry.withdrawal));

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/carteira/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryDate, balance, deposit: deposit || "0", withdrawal: withdrawal || "0" }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      alert("Erro ao salvar, tenta de novo");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Apagar o lançamento de ${entry.broker} em ${entry.entryDate.toLocaleDateString("pt-BR")}?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/carteira/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Erro ao apagar, tenta de novo");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-zinc-100 dark:border-zinc-900">
        <td className="py-2 pr-4">
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={fieldClass} />
        </td>
        <td className="py-2 pr-4 font-medium text-black dark:text-zinc-50">{entry.broker}</td>
        <td className="py-2 pr-4">
          <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className={fieldClass} />
        </td>
        <td className="py-2 pr-4">
          <input type="number" step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={fieldClass} />
        </td>
        <td className="py-2 pr-4">
          <input type="number" step="0.01" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} className={fieldClass} />
        </td>
        <td className="py-2 whitespace-nowrap">
          <button
            onClick={save}
            disabled={busy}
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={busy}
            className="ml-1 rounded px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Cancelar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-900">
      <td className="py-2 pr-4 text-zinc-500">{entry.entryDate.toLocaleDateString("pt-BR")}</td>
      <td className="py-2 pr-4 font-medium text-black dark:text-zinc-50">{entry.broker}</td>
      <td className="py-2 pr-4">{money(entry.balance)}</td>
      <td className="py-2 pr-4 text-green-600 dark:text-green-400">{entry.deposit > 0 ? money(entry.deposit) : "—"}</td>
      <td className="py-2 pr-4 text-red-600 dark:text-red-400">{entry.withdrawal > 0 ? money(entry.withdrawal) : "—"}</td>
      <td className="py-2 whitespace-nowrap">
        <button
          onClick={() => setEditing(true)}
          disabled={busy}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          Editar
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="ml-3 text-xs text-red-600 hover:underline dark:text-red-400"
        >
          Apagar
        </button>
      </td>
    </tr>
  );
}
