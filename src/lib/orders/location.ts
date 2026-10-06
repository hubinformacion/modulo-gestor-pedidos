import type { campuses, orders } from "@/db/schema";
import { campusMapUrls } from "./campus-map";

// New orders keep their snapshot. Legacy pickup orders can use current campus
// details until a snapshot exists; no coordinates or pavilion names are invented.
export function resolveOrderLocation(order: typeof orders.$inferSelect, campus: typeof campuses.$inferSelect | null) {
  const pickup = order.deliveryType === "recojo_campus";
  const coordinates = pickup && campus?.latitude !== null && campus?.longitude !== null && campus?.latitude !== undefined && campus?.longitude !== undefined
    ? { latitude: Number(campus.latitude), longitude: Number(campus.longitude) } : undefined;
  const address = pickup ? order.deliveryAddress : [order.deliveryAddress, order.deliveryDistrict, order.deliveryProvince, order.deliveryDepartment].filter(Boolean).join(", ");
  const map = campusMapUrls({ id: order.deliveryCampus ?? "", name: "", libraryAddress: address, coordinates });
  return { ...order,
    deliveryLibraryLocation: pickup ? order.deliveryLibraryLocation ?? campus?.libraryLocation ?? null : null,
    deliveryMapUrl: order.deliveryMapUrl ?? map.searchUrl,
  };
}
