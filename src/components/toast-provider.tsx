"use client";

import { Toaster } from "sileo";

export function ToastProvider() {
  return <Toaster position="bottom-right" theme="light" options={{ roundness: 12 }} />;
}
