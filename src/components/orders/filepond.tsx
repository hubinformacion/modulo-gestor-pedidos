"use client";

import { useMemo, type ComponentProps } from "react";
import { createExtension, createStoreExtension, defineFilePond, type FilePondEntry } from "filepond";
import { URLLoader } from "filepond/extensions/url-loader";
import { FileSizeValidator } from "filepond/extensions/file-size-validator";
import { locale } from "filepond/locales/es-es.js";
import { appendEntryImageView, createFilePondEntryList } from "filepond/templates";
import { isFileEntry } from "filepond/utils";
import "filepond/types/react";
import "./filepond.css";

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const template = appendEntryImageView(createFilePondEntryList(), { objectFit: "contain" });

type SaveFile = (file: File, uploadId: string) => Promise<string>;

const OrderStore = createStoreExtension<{ save?: SaveFile }>({
  name: "OrderStore",
  props: { save: undefined, parallel: 1, shouldStore: undefined },
  factory: ({ props }) => {
    const attempts = new Map<string, string>();
    return {
      async storeEntry(entry) {
        if (!isFileEntry(entry) || !entry.file || !props.save) throw new Error("No se pudo leer el archivo.");
        const file = entry.file;
        const uploadId = attempts.get(entry.id) ?? crypto.randomUUID();
        attempts.set(entry.id, uploadId);
        return props.save(file, uploadId);
      },
    };
  },
});

declare module "filepond" {
  interface FilePondElement {
    OrderStore: { save?: SaveFile; shouldStore?: (entry: FilePondEntry) => boolean };
  }
}

const PdfPoster = createExtension({
  name: "PdfPoster",
  type: "resource",
  props: {},
  factory: (_, { on, updateEntry }) => {
    const rendered = new WeakSet<File>();
    const running = new Map<string, AbortController>();
    const unsubscribe = on("updateEntryData", (entry) => {
      if (!isFileEntry(entry) || entry.file?.type !== "application/pdf" || rendered.has(entry.file)) return;
      const { file, id } = entry;
      const controller = new AbortController();
      running.set(id, controller);
      rendered.add(file);
      void import("./filepond-pdf-poster")
        .then(({ createPdfPoster }) => createPdfPoster(file, controller.signal))
        .then((poster) => {
          if (poster && !controller.signal.aborted) updateEntry(id, { extensionState: { EntryListView: { poster } } });
        })
        .catch(() => {
          if (!controller.signal.aborted) updateEntry(id, { state: { previewUnavailable: true } });
        })
        .finally(() => running.delete(id));
    });
    const unsubscribeRemove = on("removeEntry", ({ entry }) => running.get(entry.id)?.abort());
    return { destroy() {
      unsubscribe();
      unsubscribeRemove();
      for (const controller of running.values()) controller.abort();
    } };
  },
});

if (typeof window !== "undefined") {
  defineFilePond({ locale: { ...locale, store: "Reintentar carga", remove: "Retirar archivo" },
    extensions: [FileSizeValidator, PdfPoster, [URLLoader, {
      useWebWorkers: false,
      fetchMetadata: false,
      getBasename: (entry: FilePondEntry) => entry.name ?? "Archivo",
    }], OrderStore],
  });
}

export function storeStatus(entry: FilePondEntry) {
  return entry.extensionState.OrderStore?.status?.code;
}

export function entryIsLoading(entry: FilePondEntry) {
  return isFileEntry(entry) && !entry.file && !Object.values(entry.extensionState).some(({ status }) => status?.type === "error");
}

export function canStoreEntry(entry: FilePondEntry) {
  return isFileEntry(entry) && Boolean(entry.file) && !entry.state.value &&
    !Object.entries(entry.extensionState).some(([name, { status }]) => name !== "OrderStore" && status?.type === "error");
}

type OrderPondProps = Pick<ComponentProps<"file-pond">, "ref" | "name" | "onentrieschange" | "entries" | "accept"> & {
  label: string;
  mode?: "batch" | "single" | "readonly";
  locked?: boolean;
  save?: SaveFile;
  describedBy?: string;
};

export function OrderFilePond({ label, mode = "single", locked = false, save, describedBy, ...props }: OrderPondProps) {
  const readonly = mode === "readonly";
  const unavailable = readonly || locked;
  const list = useMemo(() => ({ template, drag: mode === "batch" && !locked, dragSafetyMargin: Infinity }), [mode, locked]);

  return (
    <file-pond
      className="order-filepond"
      data-locked={unavailable || undefined}
      data-batch={mode === "batch" || undefined}
      noAttribution
      noBrowse={unavailable}
      noDrop={unavailable}
      readOnly={readonly}
      maxFiles={mode === "batch" ? 8 : 1}
      maxSize={MAX_FILE_SIZE}
      aria-label={label}
      aria-describedby={describedBy}
      EntryListView={list}
      OrderStore={{ save, shouldStore: mode === "single" && save ? canStoreEntry : undefined }}
      {...props}
    />
  );
}
