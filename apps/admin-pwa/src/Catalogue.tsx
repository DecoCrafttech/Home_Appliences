import type { CatalogueOption, ServiceFormField } from "@home/shared";
export type ManagedGroup = {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  publication_status: "DRAFT" | "PUBLISHED";
  display_order: number;
  icon_object_key?: string | null;
  icon_preview_url?: string | null;
};
export type ManagedItem = ManagedGroup & {
  catalogue_category_id: string;
  kind?: string;
};
export type ManagedService = {
  id: string;
  name: string;
  appliance_category_id: string;
  appliance_name: string;
  request_type: "SERVICE" | "INSTALLATION";
  description?: string;
  display_order?: number;
  active?: boolean;
  publication_status?: "DRAFT" | "PUBLISHED";
  booking_options?: CatalogueOption[];
  form_fields: ServiceFormField[];
  base_price?: string | null;
  icon_object_key?: string | null;
  icon_url?: string | null;
  icon_preview_url?: string | null;
};
export type HomeBanner = {
  headline: string;
  description: string;
  cta: string;
  secondary: string;
  iconObjectKey: string | null;
  previewUrl?: string;
};
export type ManagedCatalogue = {
  groups: ManagedGroup[];
  categories: ManagedItem[];
  services: ManagedService[];
  banner?: HomeBanner | null;
};
export { CatalogueWorkspace as Catalogue } from "./CatalogueWorkspace";
