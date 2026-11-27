export function PdfPreview({ url, name }: { url: string; name: string }) {
  return (
    <iframe
      title={`Vista previa de ${name}`}
      src={url}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="mt-2 h-64 w-full rounded-md border border-border bg-white sm:h-80"
    />
  );
}
