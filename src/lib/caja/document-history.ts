type Document = { id: string; cycle: number; contentHash: string; uploadedAt: Date | null };
// One superseded document per completed cycle. Discarded drafts and retries
// never become separate "versions" of the same PDF in the user's history.
export function previousSaleDocuments<T extends Document>(documents: T[], cycle: number, activeId: string | null, confirmedIds: string[] = [], previousFinalizedId?: string | null): T[] {
  const active = documents.find((file) => file.id === activeId);
  if (!active || cycle < 2) return [];
  const confirmed = new Set([...confirmedIds, ...(previousFinalizedId ? [previousFinalizedId] : [])]);
  const candidates = documents.filter((file) => file.cycle < cycle && file.uploadedAt && file.id !== activeId).sort((a, b) => b.cycle - a.cycle || Number(confirmed.has(b.id)) - Number(confirmed.has(a.id)) || b.uploadedAt!.getTime() - a.uploadedAt!.getTime());
  const cycles = new Set<number>(); const hashes = new Set([active.contentHash]);
  return candidates.filter((file) => {
    if (cycles.has(file.cycle)) return false;
    cycles.add(file.cycle);
    if (hashes.has(file.contentHash)) return false;
    hashes.add(file.contentHash); return true;
  });
}
