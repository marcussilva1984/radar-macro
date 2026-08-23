"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Radar Semanal" },
  { href: "/forex", label: "Forex" },
  { href: "/correlacoes", label: "Correlações" },
  { href: "/semana", label: "Resumo da semana" },
  { href: "/videos", label: "Vídeos" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-6 py-3 text-sm">
        <span className="mr-3 h-2 w-2 rounded-full bg-blue-500" aria-hidden />
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                active
                  ? "rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white"
                  : "rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              }
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
