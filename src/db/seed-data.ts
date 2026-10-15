import type { BankForm } from "../lib/payments/banks-validation";

// Cuentas vigentes confirmadas en la configuración, sin identificadores ni timestamps.
export const initialBankAccounts = [
  {
    "publisherImprint": "universidad",
    "bank": "BBVA",
    "holder": "Universidad Continental",
    "currency": "PEN",
    "account": "0011-0235-0100038518",
    "cci": "01123500010003851895",
    "status": "ACTIVO"
  },
  {
    "publisherImprint": "universidad",
    "bank": "BCP",
    "holder": "Universidad Continental",
    "currency": "PEN",
    "account": "355-1144183-0-61",
    "cci": "00235500114418306616",
    "status": "ACTIVO"
  },
  {
    "publisherImprint": "instituto",
    "bank": "BBVA",
    "holder": "Corporación APEC SAC",
    "currency": "PEN",
    "account": "011-0235-0100038682",
    "cci": "01123500010003868299",
    "status": "ACTIVO"
  },
  {
    "publisherImprint": "instituto",
    "bank": "BCP",
    "holder": "Corporación APEC SAC",
    "currency": "PEN",
    "account": "355-1737857-0-67",
    "cci": "00235500173785706769",
    "status": "ACTIVO"
  }
] satisfies BankForm[];

// Direcciones y punto de recojo facilitados por el responsable del proyecto.
// Las coordenadas y el enlace exacto del mapa se configuran después por interfaz.
export const initialCampuses = [
  { name: "Arequipa", libraryAddress: "La Canseco II / Sector: Valle Chili, José Luis Bustamante y Rivero - Arequipa" },
  { name: "Ayacucho", libraryAddress: "Av. Javier Pérez de Cuéllar 725, Ayacucho" },
  { name: "Cusco", libraryAddress: "Sector Angostura Km. 10, carretera Cusco - Saylla, San Jerónimo, Cusco" },
  { name: "Huancayo - Instituto", libraryAddress: "Calle Real 125, Huancayo - Junín" },
  { name: "Huancayo - Universidad", libraryAddress: "Av. San Carlos 1980, Huancayo" },
  { name: "Ica", libraryAddress: "Calle C N.° 201 - Parque Industrial, Ica" },
  { name: "Lima - Los Olivos", libraryAddress: "Av. Alfredo Mendiola 5210 - Los Olivos" },
  { name: "Lima - Miraflores", libraryAddress: "Calle Junín 355, Miraflores - Lima" },
].map((campus) => ({ ...campus, libraryLocation: "Biblioteca", latitude: "", longitude: "", googleMapsEmbedUrl: "", status: "ACTIVO" as const }));
