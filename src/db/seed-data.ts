import type { BankForm } from "../lib/payments/banks-validation";

// Cuentas vigentes confirmadas en la configuración, sin identificadores ni timestamps.
export const initialBankAccounts = [
  {
    "publisherImprint": "universidad",
    "bank": "BBVA",
    "holder": "UNIVERSIDAD CONTINENTAL SOCIEDAD ANÓNIMA CERRADA",
    "currency": "PEN",
    "account": "0011-0235-0100038518",
    "cci": "011-235-000100038518-95",
    "status": "ACTIVO"
  },
  {
    "publisherImprint": "universidad",
    "bank": "BCP",
    "holder": "UNIVERSIDAD CONTINENTAL SOCIEDAD ANÓNIMA CERRADA",
    "currency": "PEN",
    "account": "355-1144183-0-61",
    "cci": "002-355-001144183061-66",
    "status": "ACTIVO"
  },
  {
    "publisherImprint": "instituto",
    "bank": "BBVA",
    "holder": "CORPORACIÓN APEC SOCIEDAD ANÓNIMA CERRADA",
    "currency": "PEN",
    "account": "0011-0235-0100038682",
    "cci": "011-235-000100038682-99",
    "status": "ACTIVO"
  },
  {
    "publisherImprint": "instituto",
    "bank": "BCP",
    "holder": "CORPORACIÓN APEC SOCIEDAD ANÓNIMA CERRADA",
    "currency": "PEN",
    "account": "355-1737857-0-67",
    "cci": "002-355-001737857067-69",
    "status": "ACTIVO"
  }
] satisfies BankForm[];

// Direcciones, ubicación interna y coordenadas proporcionadas por el responsable.
// Se conservan los nombres existentes: Real = Instituto, San Carlos = Universidad.
// Coordenadas redondeadas a los siete decimales admitidos por el esquema.
export const initialCampuses = [
  { name: "Arequipa", libraryAddress: "La Canseco II / Sector: Valle Chili, José Luis Bustamante y Rivero - Arequipa", libraryLocation: "Pabellón A, sexto piso", latitude: "-16.4123129", longitude: "-71.5243502" },
  { name: "Ayacucho", libraryAddress: "Av. Javier Pérez de Cuéllar 725, Ayacucho", libraryLocation: "En el mezzanine", latitude: "-13.1384770", longitude: "-74.2292635" },
  { name: "Cusco", libraryAddress: "Sector Angostura Km. 10, carretera Cusco - Saylla, San Jerónimo, Cusco", libraryLocation: "Pabellón A, tercer piso frente al FabLab", latitude: "-13.5560403", longitude: "-71.8563818" },
  { name: "Huancayo - Instituto", libraryAddress: "Calle Real 125, Huancayo - Junín", libraryLocation: "Primer piso, a la izquierda de la entrada principal de Jr. Arequipa, al frente del taller de diseño", latitude: "-12.0658095", longitude: "-75.2124669" },
  { name: "Huancayo - Universidad", libraryAddress: "Av. San Carlos 1980, Huancayo", libraryLocation: "Pabellón F, cuarto piso", latitude: "-12.0474963", longitude: "-75.1990642" },
  { name: "Ica", libraryAddress: "Calle C N.° 201 - Parque Industrial, Ica", libraryLocation: "Pabellón F", latitude: "-14.0500360", longitude: "-75.7506181" },
  { name: "Lima - Los Olivos", libraryAddress: "Av. Alfredo Mendiola 5210 - Los Olivos", libraryLocation: "Pabellón A, sexto piso", latitude: "-11.9739082", longitude: "-77.0658227" },
  { name: "Lima - Miraflores", libraryAddress: "Calle Junín 355, Miraflores - Lima", libraryLocation: "Segundo piso", latitude: "-12.1101961", longitude: "-77.0279912" },
].map((campus) => ({ ...campus, pickupHours: campus.name === "Lima - Miraflores" ? "Martes, jueves y viernes, de 9:00 a. m. a 5:00 p. m." : "Lunes a viernes, de 9:00 a. m. a 7:00 p. m.", googleMapsEmbedUrl: "", status: "ACTIVO" as const }));
