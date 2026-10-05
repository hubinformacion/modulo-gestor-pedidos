export type Imprint = "universidad" | "instituto";
export type CustomerKind = "comunidad_continental" | "publico_general";
export type DeliveryKind = "recojo_campus" | "delivery";
export type ShippingZone = "lima_callao" | "provincia";

export type CatalogBook = {
  id: string;
  inventoryCode: string;
  title: string;
  author: string;
  publisherImprint: Imprint;
  standardPrice: string;
  communityPrice: string;
  stock: number;
};

export type Campus = {
  id: string;
  name: string;
  libraryAddress: string;
  coordinates?: { latitude: number; longitude: number };
  googleMapsEmbedUrl?: string;
};
export type CartSelection = { bookId: string; quantity: number };

export type BuyerDraft = {
  type: CustomerKind;
  campus: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  wantsInvoice: boolean;
  billingRuc: string;
  billingBusinessName: string;
};

export type DeliveryDraft = {
  type: DeliveryKind;
  campus: string;
  department: string;
  province: string;
  district: string;
  address: string;
  reference: string;
  recipient: string;
  recipientType: "comprador" | "otra_persona";
  recipientDocument: string;
  recipientPhone: string;
};

export const imprintNames: Record<Imprint, string> = {
  universidad: "Universidad Continental",
  instituto: "Instituto Continental",
};

export const initialBuyer: BuyerDraft = {
  type: "publico_general", campus: "", name: "", email: "", phone: "", document: "",
  wantsInvoice: false, billingRuc: "", billingBusinessName: "",
};

export const initialDelivery: DeliveryDraft = {
  type: "delivery", campus: "", department: "", province: "", district: "",
  address: "", reference: "", recipientType: "comprador", recipient: "", recipientDocument: "", recipientPhone: "",
};
