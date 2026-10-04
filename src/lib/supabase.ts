import {createClient, type SupabaseClient} from '@supabase/supabase-js';
let cached:SupabaseClient|null=null;
export const isDemo=process.env.NEXT_PUBLIC_DEMO_MODE==='true';
export function getSupabase():SupabaseClient {
  if(cached)return cached;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error('Supabase Titiplen belum dikonfigurasi. Lihat .env.example.');
  cached=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return cached;
}
