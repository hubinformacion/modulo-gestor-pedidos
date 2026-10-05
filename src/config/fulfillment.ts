import type { Campus } from "@/lib/orders/types";

// Addresses supplied by the owner. Optional coordinates/embed URL take priority
// over address search; see docs/wizard.md for the precise-location configuration.
export const campuses: Campus[] = [
  { id: "arequipa", name: "Arequipa", libraryAddress: "La Canseco II / Sector: Valle Chili, José Luis Bustamante y Rivero - Arequipa" },
  { id: "ayacucho", name: "Ayacucho", libraryAddress: "Av. Javier Pérez de Cuéllar 725, Ayacucho" },
  { id: "cusco", name: "Cusco", libraryAddress: "Sector Angostura Km. 10, carretera Cusco - Saylla, San Jerónimo, Cusco" },
  { id: "huancayo-instituto", name: "Huancayo - Instituto", libraryAddress: "Calle Real 125, Huancayo - Junín" },
  { id: "huancayo-universidad", name: "Huancayo - Universidad", libraryAddress: "Av. San Carlos 1980, Huancayo" },
  { id: "ica", name: "Ica", libraryAddress: "Calle C N° 201 - Parque Industrial, Ica" },
  { id: "lima-los-olivos", name: "Lima - Los Olivos", libraryAddress: "Av. Alfredo Mendiola 5210 - Los Olivos" },
  { id: "lima-miraflores", name: "Lima - Miraflores", libraryAddress: "Calle Junín 355, Miraflores - Lima" },
];
