// Backend Pydantic schemalariga mos TypeScript tiplari

export interface User {
  id: number;
  username: string;
  role: "user" | "admin";
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ServicesBreakdown {
  rent: number;
  arava: number;
  xojatxona: number;
  parking: number;
  boshqa: number;
}

export interface Dashboard {
  total: number;
  paid: number;
  debt: number;
  services: ServicesBreakdown;
  period: { year: number; month: number };
  source: "settings" | "live";
}

export interface Pavilion {
  id: number;
  display_name: string;
  display_text: string | null;
  pavilion_type: string | null;
  polygon_points: string | null;
  fill_color: string;
  fill_opacity: number;
  stroke_color: string;
  stroke_width: number;
  label_x: number | null;
  label_y: number | null;
  label_rotation: number;
  is_active: boolean;
  display_order: number;
  meta: Record<string, unknown>;
}

export interface Shop {
  shop_id: string;
  pavilion_code: string | null;
  pavilion_id: number | null;
  inn: string | null;
  shop_type: string | null;
  purpose: string | null;
  monthly_rent: string;
  is_active: boolean;
}

export interface Counterparty {
  inn: string;
  name: string;
  contract_no: string | null;
  contract_date: string | null;
  phone: string | null;
}

export type ShopStatus = "paid" | "partial" | "unpaid" | "no_data";

export interface CategoryBalance {
  category: string;
  due: string;
  paid: string;
  debt: string;
}

export interface BillingStatus {
  shop_id: string;
  inn: string | null;
  status: ShopStatus;
  total_due: string;
  total_paid: string;
  total_debt: string;
  categories: CategoryBalance[];
}

export interface ShopDetail {
  shop: Shop;
  counterparty: Counterparty | null;
  billing: BillingStatus | null;
}

export interface PaginatedShops {
  items: Shop[];
  page: number;
  per_page: number;
  total: number;
}

export interface PavilionShops {
  pavilion_id: number;
  year: number;
  month: number;
  shops: Shop[];
  billing: Record<string, BillingStatus>;
}

export interface InnSearchResult {
  inn: string;
  name: string;
  shop_count: number;
}

export interface InnDetail {
  counterparty: Counterparty;
  shops: Shop[];
}
