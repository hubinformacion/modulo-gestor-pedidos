import Link from "next/link";

export default function NotFound() {
  return <main id="contenido" className="mx-auto max-w-xl px-6 py-24"><p className="eyebrow text-muted-foreground">Página no encontrada</p><h1 className="editorial-heading mt-4 text-4xl">Este camino no está disponible.</h1><Link href="/" className="mt-8 inline-block text-sm underline underline-offset-4">Volver al inicio</Link></main>;
}
