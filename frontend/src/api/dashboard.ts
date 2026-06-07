import { apiClient } from "./client";
import type { Dashboard } from "@/types/api";

export async function getDashboard(live = false): Promise<Dashboard> {
  const { data } = await apiClient.get<Dashboard>("/dashboard", {
    params: live ? { live: true } : {},
  });
  return data;
}
