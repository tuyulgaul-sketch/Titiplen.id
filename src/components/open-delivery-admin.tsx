'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Check,MapPin,RefreshCw,ShoppingBag,Truck,X} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';

type EventInfo={id:string;name:string};
type OrderInfo={event_id:string;phone_e164:string;customer_name:string};
type Group={id:string;event_id:string;phone_e164:string;invoice_number:string};
type Delivery={id:string;invoice_id:string;method:'manual'|'shopee';recipient_name:string|null;recipient_phone:string|null;recipient_address:string|null;notes:string;status:'pending_review'|'approved'|'rejected';created_at:string;reviewed_at:string|null};
const tags={pending_review:'Menunggu review',approved:'Dikonfirmasi',rejected:'Ditolak'};
export function DeliveryAdmin({events,orders}:{events:EventInfo[];orders:OrderInfo[]}){
 const [groups,setGroups]=useState<Group[]>([]);
 const [requests,setRequests]=useState<Delivery[]>([]);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [showAll,setShowAll]=useState(false);
 const reload=useCallback(async()=>{
  const sb=getSupabase();
  const [a,b]=await Promise.all([
   sb.from('jastip_open_event_invoices').select('id,event_id,phone_e164,invoice_number').order('created_at',{ascending:false}).limit(500),
   sb.from('jastip_open_delivery_requests').select('id,invoice_id,method,recipient_name,recipient_phone,recipient_address,notes,status,created_at,reviewed_at').order('created_at',{ascending:false}).limit(500)
  ]);
  if(a.error)throw a.error;
  if(b.error)throw b.error;
  setGroups((a.data||[]) as Group[]);setRequests((b.data||[]) as Delivery[]);
 },[]);
 useEffect(()=>{
  void reload().catch(e=>setError(e instanceof Error?e.message:'Gagal memuat pengiriman'));
  const sb=getSupabase();
  const channel=sb.channel('titiplen-delivery-admin')
   .on('postgres_changes',{event:'*',schema:'public',table:'jastip_open_delivery_requests'},()=>void reload().catch(()=>{})).subscribe();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void reload().catch(()=>{})},20000);
  return()=>{clearInterval(timer);void sb.removeChannel(channel)};
 },[reload]);
 async function review(id:string,status:'approved'|'rejected'){
  if(status==='approved'&&!window.confirm('Sudah konfirmasi pilihan pengiriman ini langsung kepada customer lewat WhatsApp?'))return;
  setBusy(id);setError('');setNotice('');
  try{
   const sb=getSupabase();
   const {error:err}=await sb.from('jastip_open_delivery_requests')
    .update({status,reviewed_at:new Date().toISOString()}).eq('id',id).eq('status','pending_review');
   if(err)throw err;
   await reload();
   setNotice(status==='approved'?'Pengiriman sudah dikonfirmasi admin.':'Pengajuan ditolak.');
  }catch(e){setError(e instanceof Error?e.message:'Gagal mengubah status');}
  finally{setBusy('');}
 }
 const counts=useMemo(()=>{
  const seen=new Set<string>();
  return requests.filter(r=>{
   if(showAll)return true;
   if(seen.has(r.invoice_id))return false;
   seen.add(r.invoice_id);return true;
  });
 },[requests,showAll]);
 const pending=requests.filter(r=>r.status==='pending_review').length;
 const summary=(g:Group|null)=>g?events.find(e=>e.id===g.event_id)?.name||'Event Jastip':'Event Jastip';
 const name=(g:Group|null)=>g?orders.find(o=>o.event_id===g.event_id&&o.phone_e164===g.phone_e164)?.customer_name||'Customer':'Customer';
 return <section className="oo-section">
  <div className="oo-card">
   <div className="oo-between">
    <div><h2>Permintaan pengiriman</h2><p className="oo-muted">Customer memilih metode setelah seluruh barang dikonfirmasi. Permintaan baru wajib diverifikasi admin karena customer tidak memakai OTP.</p></div>
    <button className="oo-button" type="button" onClick={()=>void reload().catch(e=>setError(e.message))}><RefreshCw size={15}/> Refresh</button>
   </div>
   <div className="oo-row" style={{marginTop:10}}><span className="oo-pill pending">{pending} menunggu verifikasi</span><span className="oo-pill">{requests.length} pengajuan total</span></div>
   <label className="oo-row" style={{marginTop:15,fontSize:13}}><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)} style={{accentColor:'#ae3472'}}/> Lihat seluruh riwayat pengajuan (termasuk revisi)</label>
   {error&&<div className="oo-message error">{error}</div>}
   {notice&&<div className="oo-message success">{notice}</div>}
  </div>
  <div className="oo-orders">
   {counts.length===0?<div className="oo-card"><h3>Belum ada permintaan pengiriman</h3><p className="oo-muted">Setelah invoice selesai dikonfirmasi, customer dapat memilih Shopee atau kirim manual dari halaman Invoice Saya.</p></div>:
    counts.map(r=>{
     const group=groups.find(g=>g.id===r.invoice_id)||null;
     const hasApproved=requests.some(x=>x.invoice_id===r.invoice_id&&x.status==='approved'&&x.id!==r.id);
     return <div className="oo-card" key={r.id}>
      <div className="oo-between oo-order-head">
       <div><span className={'oo-pill '+(r.status==='pending_review'?'pending':r.status==='approved'?'found':'not_found')}>{tags[r.status]}</span>
        <h2 style={{marginTop:9}}>{name(group)}</h2>
        <div className="oo-muted">{group?.phone_e164||'—'}</div>
        <div className="oo-muted">{summary(group)} · {group?.invoice_number||'—'}</div>
        <div className="oo-muted">Diajukan {new Date(r.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</div>
       </div>
       <div><span className="oo-pill">{r.method==='manual'?<><Truck size={13}/> Kirim Manual</>:<><ShoppingBag size={13}/> Checkout Shopee</>}</span></div>
      </div>
      {r.method==='manual'&&<div className="oo-summary">
       <div className="oo-row"><MapPin size={16} color="#ae3472"/><strong>Alamat penerima</strong></div>
       <div className="oo-muted" style={{marginTop:10}}><strong>{r.recipient_name||'—'}</strong> · {r.recipient_phone||'—'}</div>
       <div style={{whiteSpace:'pre-wrap',fontSize:14,marginTop:6}}>{r.recipient_address||'—'}</div>
      </div>}
      {r.notes&&<div className="oo-muted" style={{marginTop:12}}>Catatan: {r.notes}</div>}
      {r.status==='pending_review'&&<div className="oo-row" style={{marginTop:16}}>
       <button type="button" className="oo-button main" disabled={Boolean(busy)||hasApproved} onClick={()=>void review(r.id,'approved')}><Check size={16}/> Sudah dikonfirmasi via WA</button>
       <button type="button" className="oo-button" disabled={Boolean(busy)} onClick={()=>void review(r.id,'rejected')}><X size={15}/> Tolak</button>
       {hasApproved&&<p className="oo-muted">Invoice ini sudah memiliki pengiriman yang dikonfirmasi.</p>}
      </div>}
     </div>;
    })}
  </div>
 </section>;
}