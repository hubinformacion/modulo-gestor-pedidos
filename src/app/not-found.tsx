import Link from "next/link";

export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto max-w-lg px-6 py-16">
      <p className="text-xs font-medium text-muted-foreground">Error 404</p>
      <h1 className="page-heading mt-3">Página no encontrada</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">La página que buscas no está disponible.</p>
      <Link href="/admin" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-4">Volver a la administración</Link>
    </main>
  );
}
