export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Carteira protegida</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Digite a senha da Carteira pra continuar.</p>
      <form method="post" action="/api/auth/carteira" className="mt-6 space-y-3">
        <input type="hidden" name="next" value={next ?? "/forex/carteira"} />
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {erro && <p className="text-sm text-red-600 dark:text-red-400">Senha incorreta.</p>}
        <button type="submit" className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Entrar
        </button>
      </form>
    </div>
  );
}
