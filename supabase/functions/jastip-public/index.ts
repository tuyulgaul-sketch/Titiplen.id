import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const cors = {
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
 'Cache-Control':'no-store'
};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const phoneNumber=(value:string)=>{
 let n=value.replace(/[^\d]/g,'');
 if(n.startsWith('0'))n='62'+n.slice(1);
 if(n.startsWith('8'))n='62'+n;
 return /^62\d{8,13}$/.test(n)?'+'+n:null;
};
function checkMagic(bytes:Uint8Array,kind:string){
 if(kind==='image/jpeg')return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(kind==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(kind==='image/webp')return new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 return false;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!SUPABASE_URL||!SERVICE_KEY)return respond({error:'Konfigurasi server belum siap'},503);
 try{
  if(req.method==='GET'){
   const token=new URL(req.url).searchParams.get('token')||'';
   if(!uuid.test(token))return respond({error:'Link invoice tidak valid'},400);
   const {data:order,error}=await sb.from('jastip_open_orders')
    .select('invoice_number,customer_name,phone_e164,created_at,event_id')
    .eq('access_token',token).maybeSingle();
   if(error)throw error;
   if(!order)return respond({error:'Invoice tidak ditemukan'},404);
   const [groupResult,ordersResult,eventResult]=await Promise.all([
    sb.from('jastip_open_event_invoices').select('invoice_number,created_at')
      .eq('event_id',order.event_id).eq('phone_e164',order.phone_e164).maybeSingle(),
    sb.from('jastip_open_orders')
     .select('jastip_open_order_items(id,product_name,variant,notes,quantity,status,final_unit_price,admin_note)')
     .eq('event_id',order.event_id).eq('phone_e164',order.phone_e164).limit(500),
    sb.from('events').select('name').eq('id',order.event_id).maybeSingle()
   ]);
   if(groupResult.error||ordersResult.error||eventResult.error)throw groupResult.error||ordersResult.error||eventResult.error;
   const items=(ordersResult.data||[]).flatMap((o)=>o.jastip_open_order_items||[]).map((item)=>{
    const price=item.status==='found'?item.final_unit_price:0;
    return {...item,final_unit_price:price,line_total:item.quantity*price};
   });
   return respond({invoice_number:groupResult.data?.invoice_number||order.invoice_number,customer_name:order.customer_name,
      created_at:groupResult.data?.created_at||order.created_at,event_name:eventResult.data?.name||'Event Jastip',
      items,total:items.reduce((n,i)=>n+i.line_total,0),
      final:items.length>0&&items.every(i=>i.status!=='pending')});
  }
  if(req.method!=='POST')return respond({error:'Metode tidak didukung'},405);
  const type=req.headers.get('content-type')||'';
  if(!type.includes('multipart/form-data'))return respond({error:'Format form tidak sesuai'},400);
  const form=await req.formData();
  if(String(form.get('website')||'').trim())return respond({error:'Permintaan ditolak'},400);
  const clientKey=String(form.get('client_key')||'');
  const slug=String(form.get('event_slug')||'').trim();
  const name=String(form.get('customer_name')||'').trim();
  const phone=phoneNumber(String(form.get('phone')||''));
  let items:unknown;
  try{items=JSON.parse(String(form.get('items')||'[]'));}catch{return respond({error:'Daftar barang tidak valid'},400);}
  if(!uuid.test(clientKey)||!slug||name.length<2||name.length>120||!phone||!Array.isArray(items)||items.length<1||items.length>8)
    return respond({error:'Lengkapi nama, WhatsApp, dan 1–8 barang'},400);
  const parsed:{product_name:string,variant:string,notes:string,quantity:number,image_path:string}[]=[];
  const files: {path:string,file:File,bytes:Uint8Array}[]=[];
  for(let i=0;i<items.length;i++){
    const it=items[i] as Record<string,unknown>;
    const product_name=String(it?.product_name||'').trim();
    const variant=String(it?.variant||'').trim();
    const notes=String(it?.notes||'').trim();
    const quantity=Number(it?.quantity);
    const file=form.get('image_'+i);
    if(product_name.length<2||product_name.length>160||variant.length>160||notes.length>500
      ||!Number.isInteger(quantity)||quantity<1||quantity>20)
      return respond({error:'Detail barang ke-'+(i+1)+' tidak sesuai'},400);
    if(!(file instanceof File)||file.size===0||file.size>3145728)
      return respond({error:'Upload gambar maksimal 3 MB untuk barang ke-'+(i+1)},400);
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))
      return respond({error:'Gambar harus JPG, PNG, atau WebP'},400);
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(!checkMagic(bytes,file.type))return respond({error:'File gambar tidak valid'},400);
    const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
    const path=clientKey+'/'+i+'.'+ext;
    files.push({path,file,bytes});
    parsed.push({product_name,variant,notes,quantity,image_path:path});
  }
  if(files.reduce((n,f)=>n+f.bytes.byteLength,0)>12582912)return respond({error:'Total ukuran gambar maksimal 12 MB'},400);
  const duplicate=await sb.from('jastip_open_orders').select('access_token,invoice_number,event_id,phone_e164').eq('client_key',clientKey).maybeSingle();
  if(duplicate.data){
   const existingGroup=await sb.from('jastip_open_event_invoices').select('invoice_number')
     .eq('event_id',duplicate.data.event_id).eq('phone_e164',duplicate.data.phone_e164).maybeSingle();
   return respond({ok:true,invoice_number:existingGroup.data?.invoice_number||duplicate.data.invoice_number,token:duplicate.data.access_token},201);
  }
  const {data:ev,error:evError}=await sb.from('events').select('id')
    .eq('open_order_slug',slug).eq('open_order_enabled',true).eq('status','Aktif').maybeSingle();
  if(evError)throw evError;
  if(!ev)return respond({error:'Event ini sudah ditutup atau tidak ditemukan'},404);
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||
    req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim().slice(0,100);
  const salt=SERVICE_KEY;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+ip));
  const fingerprint=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
  const bucket=new Date();bucket.setUTCMinutes(0,0,0);
  const recent=await sb.from('jastip_open_rate_limits').select('hits').eq('ip_fingerprint',fingerprint)
     .eq('hour_bucket',bucket.toISOString()).maybeSingle();
  if(recent.data?.hits>=15)return respond({error:'Terlalu banyak permintaan. Coba lagi nanti.'},429);
  const uploaded:string[]=[];
  for(const file of files){
   const result=await sb.storage.from('jastip-references').upload(file.path,file.bytes,{
     contentType:file.file.type,upsert:true,cacheControl:'3600'
   });
   if(result.error){
    if(uploaded.length)await sb.storage.from('jastip-references').remove(uploaded);
    throw new Error('Upload gambar gagal: '+result.error.message);
   }
   uploaded.push(file.path);
  }
  const {data, error}=await sb.rpc('submit_jastip_open_order',{
    p_client_key:clientKey,p_event_slug:slug,p_customer_name:name,
    p_phone_e164:phone,p_items:parsed,p_ip_fingerprint:fingerprint
  });
  if(error){
   // Only remove newly uploaded photos if we can prove no order was committed.
   const recorded=await sb.from('jastip_open_orders').select('id').eq('client_key',clientKey).maybeSingle();
   if(!recorded.error&&!recorded.data&&uploaded.length)await sb.storage.from('jastip-references').remove(uploaded);
   return respond({error:error.message.includes('Terlalu banyak')?'Terlalu banyak permintaan. Coba lagi nanti.':'Gagal menyimpan pesanan. Coba kembali.'},error.message.includes('Terlalu banyak')?429:422);
  }
  const group=await sb.from('jastip_open_event_invoices').select('invoice_number')
    .eq('event_id',ev.id).eq('phone_e164',phone).maybeSingle();
  return respond({ok:true,invoice_number:group.data?.invoice_number||data.invoice_number,token:data.token},201);
 }catch(error){
  console.error('jastip-public request failed',error instanceof Error?error.message:'unknown');
  return respond({error:'Layanan sedang bermasalah. Silakan coba lagi.'},500);
 }
});