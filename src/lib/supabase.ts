import { createClient } from '@supabase/supabase-js';
import type { Lang } from '../i18n/translations';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
