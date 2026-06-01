import { apiClient } from "./client";

export interface MapLayer {
  id: number;
  market_id: number;
  name: string;
  view_w: number;
  view_h: number;
  display_order: number;
  is_active: boolean;
  has_image: boolean;
}

export async function getMapLayers(market?: string): Promise<MapLayer[]> {
  const { data } = await apiClient.get<MapLayer[]>("/maps", {
    params: market ? { market } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

export async function createMapLayer(
  name: string,
  market?: string,
  viewW?: number,
  viewH?: number,
): Promise<MapLayer> {
  const { data } = await apiClient.post<MapLayer>("/maps", { name, view_w: viewW, view_h: viewH }, {
    params: market ? { market } : undefined,
  });
  return data;
}

export async function updateMapLayer(
  id: number,
  payload: { name?: string; display_order?: number; is_active?: boolean; view_w?: number; view_h?: number },
  market?: string,
): Promise<MapLayer> {
  const { data } = await apiClient.put<MapLayer>(`/maps/${id}`, payload, {
    params: market ? { market } : undefined,
  });
  return data;
}

export async function deleteMapLayer(id: number, market?: string): Promise<void> {
  await apiClient.delete(`/maps/${id}`, { params: market ? { market } : undefined });
}

export async function uploadMapImage(id: number, file: File, market?: string): Promise<MapLayer> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<MapLayer>(`/maps/${id}/image`, form, {
    params: market ? { market } : undefined,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// Rasm URL (img src uchun). Backend base64'dan serve qiladi.
export function mapImageUrl(id: number): string {
  return `${apiClient.defaults.baseURL}/maps/${id}/image`;
}
