'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,Check,CheckCircle2,ClipboardList,Copy,ExternalLink,ImageIcon,LogOut,Plus,RefreshCw,ShoppingBag,XCircle} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';
import '../../open-order.css';
import {DeliveryAdmin} from '@/components/open-delivery-admin';
import {ShopeeLinkEditor} from '@/components/shopee-link-editor';

type EventInfo={id:string;name:string;event_date:string|null;status:string;open_order_enabled:boolean;open_order_slug:string|null;shopee_checkout_url:string|null};
type Line={id:string;product_name:string;variant:string;notes:string;quantity:number;image_path:string;status:'pending'|'found'|'not_found';final_unit_price:number;admin_note:string};
type Order={id:string;invoice_number:string;customer_name:string;phone_e164:string;event_id:string;access_token:string;created_at:string;jastip_open_order_items:Line[]};
const currency=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const labels={pending:'Menunggu',found:'Didapat',not_found:'Tidak didapat'};
function LineEditor({line,image,onSave}:{line:Line;image?:string;onSave:(status:Line['status'],price:number,note:string)=>Promise<void>}){
 const [status,setStatus]=useState<Line['status']>(line.status);
 const [price,setPrice]=useState(line.final_unit_price||0);
 const [note,setNote]=useState(line.admin_note||'');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{setStatus(line.status);setPrice(line.final_unit_price);setNote(line.admin_note||'')},[line.status,line.final_unit_price,line.admin_note]);
 async function save(){
  setError('');
  if(status==='found'&&(!Number.isSafeInteger(price)||price<=0)){setError('Isi harga final per pcs jika barang berhasil didapat.');return;}
  setSaving(true);
  try{await onSave(status,status==='found'?price:0,note);}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan status');}
  finally{setSaving(false);}
 }
 return <div className="oo-item">
  <div className="oo-item-main">
   {image?<a href={image} target="_blank" rel="noopener noreferrer"><img className="oo-image" src={image} alt={'Referensi '+line.product_name}/></a>:
    <div className="oo-image" style={{display:'grid',placeItems:'center'}}><ImageIcon size={25} color="#bc7197"/></div>}
   <div><div className="oo-between"><strong>{line.product_name}</strong><span className={'oo-pill '+line.status}>{labels[line.status]}</span></div>
    <div className="oo-muted">{line.quantity} pcs {line.variant?' · '+line.variant:''}</div>
    {line.notes&&<div className="oo-muted" style={{marginTop:4}}>Catatan customer: {line.notes}</div>}
   </div>
  </div>
  <div className="oo-status-panel">
   <div><label className="oo-label">Konfirmasi barang</label><select className="oo-input" value={status} onChange={e=>setStatus(e.target.value as Line['status'])}>
    <option value="pending">Menunggu</option><option value="found">Berhasil didapat</option><option value="not_found">Tidak didapat</option></select></div>
   <div><label className="oo-label">Harga final per pcs (Rp)</label><input type="number" min={0} step={1} className="oo-input" value={status==='found'?price:0} onChange={e=>setPrice(Number(e.target.value))} disabled={status!=='found'}/></div>
   <div className="full"><label className="oo-label">Catatan admin (tampil di invoice)</label><input className="oo-input" value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Contoh: size M habis / alternatif warna…"/></div>
   <div className="full oo-between">
    <span className="oo-muted">Nilai invoice: <strong>{currency(status==='found'?Math.max(0,price)*line.quantity:0)}</strong></span>
    <button className="oo-button main" type="button" disabled={saving} onClick={()=>void save()}><Check size={15}/>{saving?'Menyimpan…':'Simpan status'}</button>
   </div>
  </div>
  {error&&<div className="oo-message error">{error}</div>}
 </div>;
}
export default function AdminOpenOrderPage(){
 const [auth,setAuth]=useState<'checking'|'login'|'ready'>('checking');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [events,setEvents]=useState<EventInfo[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [images,setImages]=useState<Record<string,string>>({});
 const [eventName,setEventName]=useState('');
 const [eventDate,setEventDate]=useState('');
 const [filter,setFilter]=useState('all');
 const [statusFilter,setStatusFilter]=useState('all');
 const [search,setSearch]=useState('');
 const [tab,setTab]=useState<'orders'|'events'|'delivery'>('orders');
 const load=useCallback(async()=>{
  const sb=getSupabase();
  const [eventResult,orderResult]=await Promise.all([
   sb.from('events').select('id,name,event_date,status,open_order_enabled,open_order_slug,shopee_checkout_url').order('created_at',{ascending:false}),
   sb.from('jastip_open_orders').select('id,invoice_number,customer_name,phone_e164,event_id,access_token,created_at,jastip_open_order_items(id,product_name,variant,notes,quantity,image_path,status,final_unit_price,admin_note)').order('created_at',{ascending:false}).limit(500)
  ]);
  if(eventResult.error)throw eventResult.error;
  if(orderResult.error)throw orderResult.error;
  const newOrders=(orderResult.data||[]) as Order[];
  setEvents((eventResult.data||[]) as EventInfo[]);
  setOrders(newOrders);
  const paths=Array.from(new Set(newOrders.flatMap(o=>o.jastip_open_order_items||[]).map(i=>i.image_path).filter(Boolean)));
  if(paths.length){
   const signed=await Promise.all(paths.map(async path=>{
    const result=await sb.storage.from('jastip-references').createSignedUrl(path,3600);
    return [path,result.data?.signedUrl||''] as const;
   }));
   setImages(Object.fromEntries(signed));
  }
 },[]);
 useEffect(()=>{
  let mounted=true;
  (async()=>{
   try{
    const sb=getSupabase();
    const {data:{user}}=await sb.auth.getUser();
    if(!user){if(mounted)setAuth('login');return;}
    const role=await sb.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
    if(role.error||!role.data){if(mounted){setAuth('login');setError('Akun ini tidak terdaftar sebagai admin Titiplen.');}return;}
    if(mounted){setAuth('ready');await load();}
   }catch(e){if(mounted){setAuth('login');setError(e instanceof Error?e.message:'Koneksi bermasalah');}}
  })();
  return()=>{mounted=false};
 },[load]);
 useEffect(()=>{
  if(auth!=='ready')return;
  const sb=getSupabase();
  const channel=sb.channel('titiplen-open-order-admin-'+Math.random().toString(36).slice(2))
   .on('postgres_changes',{event:'*',schema:'public',table:'jastip_open_orders'},()=>void load().catch(()=>{}))
   .on('postgres_changes',{event:'*',schema:'public',table:'jastip_open_order_items'},()=>void load().catch(()=>{}))
   .subscribe();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load().catch(()=>{})},20000);
  return()=>{clearInterval(timer);void sb.removeChannel(channel)};
 },[auth,load]);
 async function login(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const sb=getSupabase();const {error:authError}=await sb.auth.signInWithPassword({email,password});
   if(authError)throw authError;
   const {data:{user}}=await sb.auth.getUser();
   const role=await sb.from('admin_users').select('user_id').eq('user_id',user?.id||'').maybeSingle();
   if(role.error||!role.data)throw new Error('Akun tidak memiliki akses admin Titiplen');
   setAuth('ready');await load();
  }catch(e){setError(e instanceof Error?e.message:'Login gagal');}finally{setBusy(false);}
 }
 async function logout(){await getSupabase().auth.signOut();setAuth('login');setOrders([]);setEvents([]);}
 async function createEvent(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const slug='event-'+crypto.randomUUID().replace(/-/g,'').slice(0,14);
   const {error:dbError}=await getSupabase().from('events')
    .insert({name:eventName.trim(),event_date:eventDate||null,status:'Aktif',open_order_enabled:true,open_order_slug:slug});
   if(dbError)throw dbError;
   setEventName('');setEventDate('');await load();setNotice('Event dibuat dan langsung menerima pesanan.');
  }catch(e){setError(e instanceof Error?e.message:'Event gagal dibuat');}finally{setBusy(false);}
 }
 async function toggleEvent(e:EventInfo){
  const active=!e.open_order_enabled;
  setBusy(true);setError('');
  try{
   const slug=e.open_order_slug||'event-'+crypto.randomUUID().replace(/-/g,'').slice(0,14);
   const {error:dbError}=await getSupabase().from('events').update({open_order_enabled:active,open_order_slug:slug})
    .eq('id',e.id);
   if(dbError)throw dbError;
   await load();setNotice(active?'Link event diaktifkan.':'Event ditutup dari pesanan baru.');
  }catch(err){setError(err instanceof Error?err.message:'Gagal mengubah event');}finally{setBusy(false);}
 }
 async function saveItem(itemId:string,status:Line['status'],price:number,note:string){
  const {error:dbError}=await getSupabase().from('jastip_open_order_items')
    .update({status,final_unit_price:status==='found'?price:0,admin_note:note.trim()})
    .eq('id',itemId);
  if(dbError)throw dbError;
  await load();setNotice('Status purchase order berhasil diperbarui.');
 }
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice('Link berhasil disalin.')}catch{setError('Tidak bisa menyalin link di browser ini.');}}
 const eventLink=(e:EventInfo)=>window.location.origin+'/event/'+e.open_order_slug;
 const invoiceLink=(o:Order)=>window.location.origin+'/pesanan/'+o.access_token;
 const visible=useMemo(()=>orders.filter(o=>{
  if(filter!=='all'&&o.event_id!==filter)return false;
  if(search&&!((o.customer_name+' '+o.phone_e164+' '+o.invoice_number+' '+o.jastip_open_order_items.map(i=>i.product_name).join(' ')).toLowerCase().includes(search.toLowerCase())))return false;
  if(statusFilter==='all')return true;
  return o.jastip_open_order_items.some(i=>i.status===statusFilter);
 }),[orders,filter,statusFilter,search]);
 const allLines=orders.flatMap(o=>o.jastip_open_order_items);
 const countStatus=(s:Line['status'])=>allLines.filter(i=>i.status===s).length;
 if(auth==='checking')return <main className="oo-page"><div className="oo-shell"><div className="oo-card">Memeriksa akses admin…</div></div></main>;
 if(auth==='login')return <main className="oo-page"><div className="oo-shell" style={{maxWidth:470}}>
  <header className="oo-header"><Link href="/" className="oo-brand">titiplen.id ♡</Link></header>
  <form className="oo-card" onSubmit={login}><h1 className="oo-title">Login admin</h1><p className="oo-muted">Purchase order hanya bisa dilihat pengelola Titiplen.</p>
   <label className="oo-label">Email admin</label><input className="oo-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
   <label className="oo-label">Password</label><input className="oo-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
   {error&&<div className="oo-message error">{error}</div>}
   <button className="oo-button main" style={{width:'100%',marginTop:18}} disabled={busy}>{busy?'Memeriksa…':'Masuk Purchase Order'}</button>
   <Link className="oo-back" href="/auth/reset-password" style={{display:'block',marginTop:14}}>Lupa password?</Link>
  </form>
 </div></main>;
 return <main className="oo-page"><div className="oo-shell">
  <header className="oo-header">
   <div><Link href="/" className="oo-brand">titiplen.id ♡<small>Purchase Order · Admin</small></Link></div>
   <div className="oo-row"><Link href="/admin" className="oo-button"><ArrowLeft size={15}/> Dashboard lama</Link><button className="oo-button" onClick={()=>void load().catch(e=>setError(e.message))}><RefreshCw size={15}/> Refresh</button><button className="oo-button" onClick={()=>void logout()}><LogOut size={15}/> Keluar</button></div>
  </header>
  <div className="oo-between"><div><span className="oo-pill">LIVE PURCHASE ORDER</span><h1 className="oo-title">Pesanan dari customer</h1><p className="oo-muted">Customer isi form sendiri, admin fokus hunting dan konfirmasi barang.</p></div><button className="oo-button main" onClick={()=>setTab('events')}><Plus size={16}/> Buat event</button></div>
  <div className="oo-grid oo-section">
   <div className="oo-summary"><div className="oo-muted">Total PO masuk</div><div className="oo-money">{orders.length}</div></div>
   <div className="oo-summary"><div className="oo-muted">Barang menunggu</div><div className="oo-money">{countStatus('pending')}</div><div className="oo-muted">Didapat {countStatus('found')} · Tidak didapat {countStatus('not_found')}</div></div>
  </div>
  {error&&<div className="oo-message error">{error}</div>}
  {notice&&<div className="oo-message success">{notice}</div>}
  <div className="oo-tabs oo-section"><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}><ClipboardList size={15} style={{display:'inline'}}/> Purchase Order</button><button className={tab==='events'?'active':''} onClick={()=>setTab('events')}><ShoppingBag size={15} style={{display:'inline'}}/> Kelola Event</button><button className={tab==='delivery'?'active':''} onClick={()=>setTab('delivery')}><CheckCircle2 size={15} style={{display:'inline'}}/> Pengiriman</button></div>
  {tab==='delivery'&&<DeliveryAdmin events={events} orders={orders}/>}
  {tab==='events'&&<div className="oo-section">
   <form className="oo-card" onSubmit={createEvent}>
    <h2>Buat event jastip</h2><p className="oo-muted">Share link event ke WhatsApp/Instagram. Customer bisa upload pesanan tanpa login.</p>
    <div className="oo-grid">
     <div><label className="oo-label">Nama event</label><input className="oo-input" value={eventName} onChange={e=>setEventName(e.target.value)} placeholder="Contoh: Zara Sale November" minLength={2} maxLength={160} required/></div>
     <div><label className="oo-label">Tanggal event (opsional)</label><input className="oo-input" type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)}/></div>
    </div>
    <button className="oo-button main" style={{marginTop:15}} disabled={busy}><Plus size={15}/> Buat & buka order</button>
   </form>
   <div className="oo-card oo-section"><h2>Daftar event</h2>{events.length===0?<p className="oo-muted">Belum ada event.</p>:events.map(e=><div className="oo-invoice-line" style={{flexWrap:"wrap"}} key={e.id}>
     <div style={{flex:1}}><strong>{e.name}</strong><div className="oo-muted">{e.event_date||'Tanpa tanggal'} · {e.status}</div><div style={{marginTop:6}}><span className={'oo-pill '+(e.open_order_enabled&&e.status==='Aktif'?'found':'pending')}>{e.open_order_enabled&&e.status==='Aktif'?'Menerima order':'Ditutup'}</span></div></div>
     <div className="oo-row">
      {e.open_order_slug&&<><button className="oo-button" onClick={()=>void copy(eventLink(e))}><Copy size={14}/> Copy link</button><a className="oo-button" href={eventLink(e)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Buka</a></>}
      <button className="oo-button" disabled={busy||e.status!=='Aktif'&&!e.open_order_enabled} onClick={()=>void toggleEvent(e)}>{e.open_order_enabled?'Tutup order':'Buka order'}</button>
     </div>
    <ShopeeLinkEditor event={e} onSaved={load}/>
    </div>)}</div>
  </div>}
  {tab==='orders'&&<div className="oo-section">
   <div className="oo-card">
    <div className="oo-between"><h2 style={{margin:0}}>Daftar purchase order</h2><span className="oo-counter">{visible.length} PO</span></div>
    <div className="oo-grid" style={{marginTop:14}}>
     <div><label className="oo-label">Event</label><select className="oo-input" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Semua event</option>{events.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></div>
     <div><label className="oo-label">Status barang</label><select className="oo-input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Semua status</option><option value="pending">Menunggu</option><option value="found">Didapat</option><option value="not_found">Tidak didapat</option></select></div>
    </div>
    <label className="oo-label">Cari customer / WhatsApp / barang</label><input className="oo-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, nomor, produk…"/>
   </div>
   <div className="oo-orders">{visible.length===0?<div className="oo-card"><h3>Belum ada pesanan</h3><p className="oo-muted">Buat event dan share link supaya customer bisa mulai memesan.</p></div>:visible.map(o=>{
    const subtotal=o.jastip_open_order_items.reduce((n,i)=>n+(i.status==='found'?i.quantity*i.final_unit_price:0),0);
    const unresolved=o.jastip_open_order_items.some(i=>i.status==='pending');
    const ev=events.find(e=>e.id===o.event_id);
    return <section className="oo-card" key={o.id}>
     <div className="oo-order-head oo-between"><div><span className="oo-pill">{o.invoice_number}</span><h2 style={{marginTop:8}}>{o.customer_name}</h2><div className="oo-muted">{o.phone_e164} · {ev?.name||'Event'} · {new Date(o.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</div></div>
      <div><span className={'oo-pill '+(unresolved?'pending':'found')}>{unresolved?'Sedang diproses':'Semua dikonfirmasi'}</span><div className="oo-money" style={{marginTop:6}}>{currency(subtotal)}</div></div>
     </div>
     <div className="oo-between"><strong>List barang ({o.jastip_open_order_items.length})</strong><div className="oo-row"><button className="oo-button" onClick={()=>void copy(invoiceLink(o))}><Copy size={14}/> Link invoice</button><a className="oo-button" href={invoiceLink(o)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Lihat</a></div></div>
     <div className="oo-order-items">{o.jastip_open_order_items.map(line=><LineEditor key={line.id} line={line} image={images[line.image_path]} onSave={(status,price,note)=>saveItem(line.id,status,price,note)}/>)}</div>
    </section>;
   })}</div>
  </div>}
 </div></main>;
}