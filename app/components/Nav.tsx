import Link from "next/link";

const LINKS = [
  { href: "/", label: "Timeline" },
  { href: "/correlacoes", label: "Correlações" },
  { href: "/semana", label: "Resumo da semana" },
  { href: "/videos", label: "Vídeos" },
];

export function Nav() {
  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-3xl gap-4 px-6 py-3 text-sm">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
