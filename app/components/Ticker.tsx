import type { TickerItem } from "@/lib/liveQuotes";

function fmtPrice(v: number) {
  return v < 10 ? v.toFixed(4) : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function Item({ item }: { item: TickerItem }) {
  const up = item.changePct >= 0;
  return (
    <span className="mx-4 inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
      <span className="text-zinc-500">{fmtPrice(item.price)}</span>
      <span className={up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
        {up ? "+" : ""}
        {item.changePct.toFixed(2)}%
      </span>
    </span>
  );
}

// Guia que roda na tela (marquee) com forex + cripto da watchlist — duplica a lista pra dar
// um loop contínuo sem buraco quando a animação CSS reinicia.
export function Ticker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden border-b border-zinc-200 bg-white py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="ticker-track flex w-max">
        <div className="flex shrink-0">
          {items.map((item, i) => (
            <Item key={`a-${i}`} item={item} />
          ))}
        </div>
        <div className="flex shrink-0" aria-hidden>
          {items.map((item, i) => (
            <Item key={`b-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
