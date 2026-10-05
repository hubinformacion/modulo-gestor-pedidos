"use client";

import { Skeleton } from "boneyard-js/react";
import type { SkeletonResult } from "boneyard-js";

const bones: SkeletonResult = {
  name: "order-wizard", viewportWidth: 720, width: 720, height: 470,
  bones: [
    [0, 0, 720, 50, 4], [0, 90, 320, 30, 3], [0, 136, 440, 14, 2],
    [0, 185, 720, 44, 8], [0, 253, 120, 30, 6], [135, 253, 120, 30, 6],
    [0, 307, 720, 150, 12, true], [24, 330, 250, 14, 2], [24, 365, 420, 20, 3], [24, 414, 130, 16, 3],
  ],
};

export function WizardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando publicaciones">
      <Skeleton loading initialBones={bones} color="#e7e7ed" animate="pulse" fallback={<div className="h-118 rounded-xl bg-muted motion-safe:animate-pulse" />}>
        <div className="h-118" />
      </Skeleton>
      <span className="sr-only">Cargando publicaciones…</span>
    </div>
  );
}
