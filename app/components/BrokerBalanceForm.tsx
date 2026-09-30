"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BROKERS = ["EBC", "AXI", "ICMarkets", "FBS"] as const;

const fieldClass =
  "mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelClass = "block text-xs font-medium text-zinc-500";

export function BrokerBalanceForm() {
  const router = useRouter();
  const [broker, setBroker] = useState<string>(BROKERS[0]);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [balance, setBalance] = useState("");
  const [deposit, setDeposit] = useState("");
  const [withdrawal, setWithdrawal] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!balance) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/carteira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker, entryDate, balance, deposit: deposit || "0", withdrawal: withdrawal || "0" }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setBalance("");
      setDeposit("");
      setWithdrawal("");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      <div>
        <label className={labelClass}>Corretora</label>
        <select
          value={broker}
          onChange={(e) => setBroker(e.target.value)}
          className={fieldClass}
        >
          {BROKERS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Data</label>
        <input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>Saldo atual</label>
        <input
          type="number"
          step="0.01"
          placeholder="ex: 1949"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          required
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>Depósito (se fez)</label>
        <input
          type="number"
          step="0.01"
          placeholder="0"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>Retirada (se fez)</label>
        <input
          type="number"
          step="0.01"
          placeholder="0"
          value={withdrawal}
          onChange={(e) => setWithdrawal(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "sending" ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {status === "sent" && <span className="col-span-full text-xs text-green-600 dark:text-green-400">Salvo!</span>}
      {status === "error" && <span className="col-span-full text-xs text-red-600 dark:text-red-400">Erro, tenta de novo</span>}
    </form>
  );
}
