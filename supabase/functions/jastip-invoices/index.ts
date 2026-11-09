import {createClient} from 'npm:@supabase/supabase-js@2.49.4';

const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const supabase=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Cache-Control':'no-store',
 'Content-Type':'application/json; charset=utf-8'
};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function phone(value:unknown):string|null{
 let n=String(value||'').replace(/\D/g,'');
 if(n.startsWith('0'))n='62'+n.slice(1);
 else if(n.startsWith('8'))n='62'+n;
 return /^62[0-9]{8,13}$/.test(n)?'+'+n:null;
}
function limitedText(value:unknown,max:number){return String(value||'').trim().slice(0,max+1);}
async function fingerprint(req:Request){
 const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||
   req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim().slice(0,100);
 const raw=new TextEncoder().encode(serviceKey+':lookup-delivery:'+ip);
 const b=await crypto.subtle.digest('SHA-256',raw);
 return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function throttle(scope:'lookup'|'delivery',f:string){
 const {data,error}=await supabase.rpc('take_jastip_public_action',{
   p_scope:scope,p_ip_fingerprint:f
 });
 if(error)throw error;
 return data===true;
}
type InvoiceGroup={id:string;event_id:string;invoice_number:string;created_at:string};
type EventInfo={id:string;name:string;shopee_checkout_url:string|null};
type PurchaseLine={id:string;product_name:string;variant:string;quantity:number;status:string;final_unit_price:number;admin_note:string};
type SubmittedOrder={id:string;event_id:string;jastip_open_order_items:PurchaseLine[]};
async function invoiceData(normalizedPhone:string,onlyGroup?:InvoiceGroup){
 const {data:groups,error}=onlyGroup?
   {data:[onlyGroup],error:null}:
   await supabase.from('jastip_open_event_invoices').select('id,event_id,invoice_number,created_at')
    .eq('phone_e164',normalizedPhone).order('created_at',{ascending:false}).limit(40);
 if(error)throw error;
 const list=(groups||[]) as InvoiceGroup[];
 if(!list.length)return [];
 const eventIds=Array.from(new Set(list.map(g=>g.event_id)));
 const [eventsResult,ordersResult,deliveryResult]=await Promise.all([
   supabase.from('events').select('id,name,shopee_checkout_url').in('id',eventIds),
   supabase.from('jastip_open_orders').select('id,event_id,jastip_open_order_items(id,product_name,variant,quantity,status,final_unit_price,admin_note)')
     .eq('phone_e164',normalizedPhone).in('event_id',eventIds).limit(500),
   supabase.from('jastip_open_delivery_requests').select('invoice_id,method,status,created_at')
     .in('invoice_id',list.map(g=>g.id)).order('created_at',{ascending:false}).limit(300)
 ]);
 if(eventsResult.error)throw eventsResult.error;
 if(ordersResult.error)throw ordersResult.error;
 if(deliveryResult.error)throw deliveryResult.error;
 const evs=(eventsResult.data||[]) as EventInfo[];
 const orders=(ordersResult.data||[]) as SubmittedOrder[];
 const latest=new Map<string,{method:string;status:string}>();
 for(const req of deliveryResult.data||[]){
   const previous=latest.get(req.invoice_id);
   if(!previous||(req.status==='approved'&&previous.status!=='approved'))
     latest.set(req.invoice_id,{method:req.method,status:req.status});
 }
 return list.map(g=>{
   const event=evs.find(e=>e.id===g.event_id);
   const items=orders.filter(o=>o.event_id===g.event_id).flatMap(o=>o.jastip_open_order_items||[])
     .map(i=>({
       id:i.id,product_name:i.product_name,variant:i.variant,quantity:i.quantity,
       status:i.status,admin_note:i.admin_note,
       final_unit_price:i.status==='found'?i.final_unit_price:0,
       total:i.status==='found'?i.final_unit_price*i.quantity:0
     }));
   const pending=items.filter(i=>i.status==='pending').length;
   const found=items.filter(i=>i.status==='found').length;
   return {
     id:g.id,invoice_number:g.invoice_number,event_name:event?.name||'Event Jastip',
     event_id:g.event_id,created_at:g.created_at,
     items,total:items.reduce((n,i)=>n+i.total,0),pending,found,
     final:items.length>0&&pending===0,
     method_choice:latest.get(g.id)||null,
     shopee_checkout_url:event?.shopee_checkout_url||null
   };
 });
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return respond({error:'Metode tidak didukung'},405);
 if(!supabaseUrl||!serviceKey)return respond({error:'Server belum siap'},503);
 try{
  const contentType=req.headers.get('content-type')||'';
  if(!contentType.includes('application/json'))return respond({error:'Format tidak valid'},415);
  const raw=await req.text();
  if(raw.length>6000)return respond({error:'Data terlalu besar'},413);
  let body:Record<string,unknown>;
  try{body=JSON.parse(raw);}catch{return respond({error:'Format JSON tidak valid'},400);}
  const action=String(body.action||'');
  if(body.website)return respond({error:'Permintaan tidak valid'},400);
  if(action!=='lookup'&&action!=='delivery')return respond({error:'Aksi tidak dikenal'},400);
  const normalized=phone(body.phone);
  if(!normalized)return respond({error:'Nomor WhatsApp tidak valid'},400);
  const hash=await fingerprint(req);
  if(!await throttle(action,hash))return respond({error:'Batas akses tercapai. Coba lagi nanti.'},429);
  if(action==='lookup'){
   const invoices=await invoiceData(normalized);
   return respond({invoices});
  }
  const invoiceId=String(body.invoice_id||'');
  const method=String(body.method||'');
  if(!uuid.test(invoiceId)||!['shopee','manual'].includes(method))
   return respond({error:'Pilih invoice dan metode pengiriman yang benar'},400);
  const {data:group,error:groupError}=await supabase.from('jastip_open_event_invoices')
   .select('id,event_id,invoice_number,created_at')
   .eq('id',invoiceId).eq('phone_e164',normalized).maybeSingle();
  if(groupError)throw groupError;
  if(!group)return respond({error:'Invoice tidak ditemukan'},404);
  const groups=await invoiceData(normalized,group as InvoiceGroup);
  const invoice=groups[0];
  if(!invoice?.final)return respond({error:'Tunggu semua barang dikonfirmasi admin sebelum memilih pengiriman'},409);
  if(invoice.found<=0)return respond({error:'Tidak ada barang yang berhasil didapat untuk dikirim'},409);
  const {data:approved,error:approvedError}=await supabase.from('jastip_open_delivery_requests')
   .select('id').eq('invoice_id',invoiceId).eq('status','approved').limit(1);
  if(approvedError)throw approvedError;
  if(approved?.length)return respond({error:'Pilihan pengiriman sudah dikonfirmasi admin. Hubungi admin jika ingin mengubahnya.'},409);
  const since=new Date(Date.now()-86400000).toISOString();
  const {count,error:countError}=await supabase.from('jastip_open_delivery_requests')
   .select('id',{count:'exact',head:true}).eq('invoice_id',invoiceId).gte('created_at',since);
  if(countError)throw countError;
  if((count||0)>=5)return respond({error:'Terlalu banyak pengajuan untuk invoice ini. Hubungi admin.'},429);
  let recipientName:null|string=null,recipientPhone:null|string=null,recipientAddress:null|string=null;
  const notes=limitedText(body.notes,500);
  if(notes.length>500)return respond({error:'Catatan terlalu panjang'},400);
  if(method==='manual'){
   recipientName=limitedText(body.recipient_name,120);
   recipientPhone=phone(body.recipient_phone);
   recipientAddress=limitedText(body.recipient_address,1000);
   if(recipientName.length<2||recipientName.length>120||!recipientPhone||
     recipientAddress.length<15||recipientAddress.length>1000)
    return respond({error:'Lengkapi nama penerima, nomor HP, dan alamat lengkap'},400);
  }
  const {error:saveError}=await supabase.from('jastip_open_delivery_requests').insert({
   invoice_id:invoiceId,method,recipient_name:recipientName,recipient_phone:recipientPhone,
   recipient_address:recipientAddress,notes,status:'pending_review'
  });
  if(saveError)throw saveError;
  return respond({ok:true,status:'pending_review',method,
    shopee_checkout_url:method==='shopee'?invoice.shopee_checkout_url:null});
 }catch(error){
  console.error('jastip-invoices error',error instanceof Error?error.message:'unknown');
  return respond({error:'Layanan sedang bermasalah. Silakan coba lagi.'},500);
 }
});