import type { Imprint } from "@/lib/orders/types";
export function treasuryScopes(record: { publisherImprints: Imprint[]; publisherImprint: Imprint | null }): Imprint[] {
  return [...new Set(record.publisherImprints.length ? record.publisherImprints : record.publisherImprint ? [record.publisherImprint] : [])];
}
