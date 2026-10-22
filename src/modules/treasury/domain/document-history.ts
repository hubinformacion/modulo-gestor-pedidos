type Document = { id: string; cycle: number; contentHash: string; uploadedAt: Date | null };
// One superseded document per completed cycle. Discarded drafts and retries
// never become separate "versions" of the same PDF in the user's history.
// A genuine correction may reuse identical bytes: hash equality must not hide
// its previous finalized document, including while its replacement is pending.
export function previousSaleDocuments<T extends Document>(documents: T[], cycle: number, activeId: string | null, confirmedIds: string[] = [], previousFinalizedId?: string | null): T[] {
  if (cycle < 2) return [];
  const confirmed = new Set([...confirmedIds, ...(previousFinalizedId ? [previousFinalizedId] : [])]);
  const candidates = documents.filter((file) => file.cycle < cycle && file.uploadedAt && file.id !== activeId).sort((a, b) => b.cycle - a.cycle || Number(confirmed.has(b.id)) - Number(confirmed.has(a.id)) || b.uploadedAt!.getTime() - a.uploadedAt!.getTime());
  const cycles = new Set<number>();
  return candidates.filter((file) => {
    if (cycles.has(file.cycle)) return false;
    cycles.add(file.cycle);
    return true;
  });
}
