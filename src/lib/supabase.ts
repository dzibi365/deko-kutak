import { createClient } from '@supabase/supabase-js';
import type { Lang } from '../i18n/translations';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type CustomFieldType = 'text' | 'textarea' | 'select' | 'checkbox' | 'image';

export type PriceOption = {
  id: string;
  label_en: string;
  label_bs: string;
  price: number;
};

export type AddonOption = {
  id: string;
  label_en: string;
  label_bs: string;
  price_adjustment: number;
  text_required?: boolean;
};

export type AddonGroup = {
  id: string;
  label_en: string;
  label_bs: string;
  location: 'product_page' | 'personalization_modal';
  required?: boolean;
  options: AddonOption[];
};

export type CustomField = {
  id: string;
  label_en: string;
  label_bs: string;
  placeholder_en: string;
  placeholder_bs: string;
  type: CustomFieldType;
  options: string[];
  options_en?: string[];
  options_bs?: string[];
  required: boolean;
  required_if?: {
    field_id: string;
    value: string;
  };
};

export type Product = {
  id: number;
  name: string;
  name_en: string | null;
  name_bs: string | null;
  category: string;
  price: number;
  compare_price: number | null;
  description: string | null;
  description_en: string | null;
  description_bs: string | null;
  image_url: string | null;
  gallery_images: string[] | null;
  in_stock: boolean;
  custom_fields: CustomField[] | null;
  similar_products: number[] | null;
  has_3d_preview: boolean;
  model_3d_url: string | null;
  model_texture_mesh: string | null;
  requires_personalization: boolean;
  short_description_en: string | null;
  short_description_bs: string | null;
  price_options: PriceOption[] | null;
  personalization_note_en: string | null;
  personalization_note_bs: string | null;
  addon_groups: AddonGroup[] | null;
  created_at: string;
};

export type FieldGroup = {
  id: number;
  name: string;
  fields: CustomField[];
  created_at: string;
};

export type Category = {
  id: number;
  name: string;
  name_en: string | null;
  name_bs: string | null;
  image_url: string | null;
  created_at: string;
};

export function localName(obj: { name: string; name_en?: string | null; name_bs?: string | null }, lang: Lang): string {
  if (lang === 'bs') return obj.name_bs || obj.name_en || obj.name;
  return obj.name_en || obj.name;
}

export function localDesc(obj: { description?: string | null; description_en?: string | null; description_bs?: string | null }, lang: Lang): string | null {
  if (lang === 'bs') return obj.description_bs || obj.description_en || obj.description || null;
  return obj.description_en || obj.description || null;
}

export type GalleryCategory = {
  id: number;
  name_en: string;
  name_bs: string;
  display_order: number;
  created_at: string;
};

export type GalleryItem = {
  id: number;
  title_en: string;
  title_bs: string;
  description_en: string | null;
  description_bs: string | null;
  cover_image_url: string | null;
  category_id: number | null;
  is_published: boolean;
  display_order: number;
  related_product_id: number | null;
  created_at: string;
  updated_at: string;
};

export type GalleryImage = {
  id: number;
  gallery_item_id: number;
  image_url: string;
  caption_en: string | null;
  caption_bs: string | null;
  display_order: number;
  created_at: string;
};

export type GalleryVideo = {
  id: number;
  gallery_item_id: number;
  video_url: string;
  poster_url: string | null;
  caption_en: string | null;
  caption_bs: string | null;
  display_order: number;
  created_at: string;
};
