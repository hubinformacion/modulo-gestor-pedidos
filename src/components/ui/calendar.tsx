"use client";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { cn } from "@/shared/utils/cn";
export function Calendar({ className, ...props }: ComponentProps<typeof DayPicker>) {
  return <DayPicker locale={es} showOutsideDays weekStartsOn={1} labels={{ labelNext: () => "Mes siguiente", labelPrevious: () => "Mes anterior" }} className={cn("app-calendar", className)} {...props} />;
}
