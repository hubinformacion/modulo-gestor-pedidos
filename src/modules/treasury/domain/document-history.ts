type Document = { id: string; cycle: number; mimeType: string; uploadedAt: Date | null };
// One superseded document of each format per completed cycle. Discarded drafts and retries
// never become separate "versions" of the same PDF in the user's history.
// A genuine correction may reuse identical bytes: hash equality must not hide
// its previous finalized document, including while its replacement is pending.
export function previousSaleDocuments<T extends Document>(documents: T[], cycle: number, activeIds: (string | null)[], confirmedIds: string[], previousFinalizedIds: (string | null)[]): T[] {
  if (cycle < 2) return [];
  const confirmed = new Set([...confirmedIds, ...previousFinalizedIds]);
  const candidates = documents.filter((file) => file.cycle < cycle && file.uploadedAt && !activeIds.includes(file.id)).sort((a, b) => b.cycle - a.cycle || Number(confirmed.has(b.id)) - Number(confirmed.has(a.id)) || b.uploadedAt!.getTime() - a.uploadedAt!.getTime());
  const cycles = new Set<string>();
  return candidates.filter((file) => {
    const key = `${file.cycle}:${file.mimeType}`;
    if (cycles.has(key)) return false;
    cycles.add(key);
    return true;
  });
}
