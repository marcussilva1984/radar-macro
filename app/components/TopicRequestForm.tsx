"use client";

import { useState } from "react";

export function TopicRequestForm() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setText("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Quer que o radar rastreie mais algum tema/país/ativo?"
        maxLength={200}
        className="flex-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {status === "sending" ? "Enviando…" : "Pedir"}
      </button>
      {status === "sent" && <span className="self-center text-xs text-green-600 dark:text-green-400">Registrado!</span>}
      {status === "error" && <span className="self-center text-xs text-red-600 dark:text-red-400">Erro, tenta de novo</span>}
    </form>
  );
}
