"use client";

import { Skeleton } from "boneyard-js/react";
import type { SkeletonResult } from "boneyard-js";

const bones: SkeletonResult = {
  name: "authorized-emails", viewportWidth: 720, width: 720, height: 280,
  bones: [
    [0, 0, 170, 12, 2], [0, 35, 320, 38, 3],
    [0, 95, 460, 14, 2], [0, 145, 720, 125, 8, true],
    [24, 172, 260, 14, 2], [24, 205, 180, 12, 2],
  ],
};

export function AccessSkeleton() {
  return (
    <div role="status" aria-label="Cargando administración" aria-busy="true">
      <Skeleton loading initialBones={bones} color="#e7e7ed" animate="pulse" fallback={<div className="h-70 rounded-lg bg-muted motion-safe:animate-pulse" />}>
        <div className="h-70" />
      </Skeleton>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
