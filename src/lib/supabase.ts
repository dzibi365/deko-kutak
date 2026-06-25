import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string | null;
  image_url: string | null;
  in_stock: boolean;
  created_at: string;
};
