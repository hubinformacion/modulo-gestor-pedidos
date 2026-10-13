"use client";

import { Toaster } from "sileo";

export function ToastProvider() {
  return <Toaster position="bottom-right" theme="light" offset={16} options={{ roundness: 12, duration: 6000, autopilot: { expand: 300, collapse: 4800 } }} />;
}
