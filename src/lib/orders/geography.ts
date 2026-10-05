import data from "@/data/ubigeo/peru.json";
import type { ShippingZone } from "./types";

export type GeoOption = { id: string; name: string };
const options = (rows: string[][]): GeoOption[] => rows.map(([id, name]) => ({ id, name }));
export const departments = options(data.departments);
const provinces = options(data.provinces);
const districts = options(data.districts);
const districtById = new Map(districts.map((district) => [district.id, district]));

export function provincesFor(department: string): GeoOption[] {
  if (department.length !== 2) return [];
  return provinces.filter((province) => province.id.startsWith(department));
}

export function districtsFor(province: string): GeoOption[] {
  if (province.length !== 4) return [];
  return districts.filter((district) => district.id.startsWith(province));
}

export function resolveLocation(districtId: string) {
  const district = districtById.get(districtId);
  if (!district) return null;
  const province = provinces.find((option) => option.id === districtId.slice(0, 4))!;
  const department = departments.find((option) => option.id === districtId.slice(0, 2))!;
  const zone: ShippingZone = ["1501", "0701"].includes(province.id) ? "lima_callao" : "provincia";
  return { department, province, district, zone };
}

export function resolveShippingZone(districtId: string): ShippingZone | "" {
  return resolveLocation(districtId)?.zone ?? "";
}
