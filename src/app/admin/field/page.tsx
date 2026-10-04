'use client';

import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,BookOpenCheck,Check,CheckCircle2,ChevronDown,Clock3,Cloud,CloudOff,FileText,Home,LayoutDashboard,Package,Plus,ReceiptText,RefreshCw,Save,Search,ShoppingBag,Smartphone,Trash2,UserPlus,Users,WifiOff} from 'lucide-react';
import {BrandMark} from '@/components/brand-mark';
import {Money} from '@/components/money-input';
import {readDemo,insertDemo,updateItemPurchaseDemo} from '@/lib/demo';
import {idr,lineSales,lineProfit,lineCost,normalizePhone,shortDate} from '@/lib/finance';
import {getSupabase,isDemo} from '@/lib/supabase';
import type {StoreData,StoreTable,OrderItem} from '@/lib/types';

type ItemDraft={
 brand:string;product_name:string;variant:string;quantity:number;
 cost_unit:number;fee_unit:number;extra_fee_unit:number;
 shipping_charge:number;shipping_cost:number;discount:number;
};
type SavedDraft={eventId:string;customerId:string;item:ItemDraft;notes:string;purchased:boolean};
const DRAFT_KEY='titiplen.field.draft.v1';
const emptyItem=():ItemDraft=>({
 brand:'',product_name:'',variant:'',quantity:1,cost_unit:0,fee_unit:0,extra_fee_unit:0,
 shipping_charge:0,shipping_cost:0,discount:0
});
function Field({label,children}:{label:string;children:React.ReactNode}){
 return <label className="field-mobile-label"><span>{label}</span>{children}</label>;
}
function Status({purchased}:{purchased:boolean}){
 return <span className={'field-status '+(purchased?'done':'pending')}>{purchased?<><Check size={13}/> Sudah dibeli</>:<><Clock3 size={13}/> Belum dibeli</>}</span>;
}
function uuid(){return crypto.randomUUID();}
export default function FieldShoppingPage(){
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [loadError,setLoadError]=useState('');
 const [actionError,setActionError]=useState('');
 const [notice,setNotice]=useState('');
 const [online,setOnline]=useState(true);
 const [data,setData]=useState<StoreData|null>(null);
 const [eventId,setEventId]=useState('');
 const [customerId,setCustomerId]=useState('');
 const [customerSearch,setCustomerSearch]=useState('');
 const [item,setItem]=useState<ItemDraft>(emptyItem);
 const [notes,setNotes]=useState('');
 const [purchased,setPurchased]=useState(true);
 const [more,setMore]=useState(false);
 const [showAddCustomer,setShowAddCustomer]=useState(false);
 const [newCustomer,setNewCustomer]=useState({name:'',phone:''});
 const [showAddEvent,setShowAddEvent]=useState(false);
 const [newEvent,setNewEvent]=useState({name:'',date:new Date().toLocaleDateString('en-CA')});
 const [view,setView]=useState<'write'|'recap'>('write');
 const [lastSaved,setLastSaved]=useState('');
 const keyRef=useRef<string>(uuid());
 const itemRef=useRef<HTMLInputElement>(null);
 const hydrated=useRef(false);

 const changed=(key:keyof ItemDraft,val:string|number)=>{
   setItem(old=>({...old,[key]:val}));
   keyRef.current=uuid();
   setNotice('');
 };
 const purchaseItems=useMemo(()=>{
   if(!data||!eventId)return [];
   const orders=new Map(data.orders.filter(o=>o.event_id===eventId).map(o=>[o.id,o]));
   return data.order_items.filter(line=>orders.has(line.order_id)).sort((a,b)=>{
     const da=orders.get(a.order_id)?.created_at||'',db=orders.get(b.order_id)?.created_at||'';
     return db.localeCompare(da);
   }).map(line=>({line,order:orders.get(line.order_id)!}));
 },[data,eventId]);
 const completed=purchaseItems.filter(x=>x.line.purchase_status!=='planned');
 const pending=purchaseItems.filter(x=>x.line.purchase_status==='planned');
 const totalSpent=completed.reduce((sum,{line})=>sum+lineCost(line),0);
 const expectedSales=completed.reduce((sum,{line})=>sum+lineSales(line),0);
 const events=(data?.events||[]).slice().sort((a,b)=>{
   if(a.status!==b.status)return a.status==='Aktif'?-1:1;
   return (b.event_date||'').localeCompare(a.event_date||'');
 });
 const customers=(data?.customers||[]).filter(c=>(c.name+' '+c.phone_e164).toLowerCase().includes(customerSearch.toLowerCase())).slice().sort((a,b)=>a.name.localeCompare(b.name,'id'));
 const selectedEvent=data?.events.find(e=>e.id===eventId);
 const selectedCustomer=data?.customers.find(c=>c.id===customerId);

 async function load(){
  if(isDemo){setData(readDemo());return;}
  const sb=getSupabase();
  const tables:StoreTable[]=['customers','events','orders','order_items','invoices','invoice_items','payments','expenses','settings'];
  const values=await Promise.all(tables.map(async t=>{
   const rows:Record<string,unknown>[]=[];
   for(let from=0;;from+=1000){
     const q=await sb.from(t).select('*').range(from,from+999);
     if(q.error)throw new Error('Tidak dapat memuat '+t+': '+q.error.message);
     rows.push(...q.data||[]);
     if((q.data||[]).length<1000)break;
   }
   return [t,rows] as const;
  }));
  setData(Object.fromEntries(values) as unknown as StoreData);
 }
 async function verify(){
  try{
   if(!isDemo){
     const sb=getSupabase();
     const {data:auth,error}=await sb.auth.getUser();
     if(error||!auth.user){window.location.replace('/admin');return;}
     const role=await sb.from('admin_users').select('user_id').eq('user_id',auth.user.id).maybeSingle();
     if(role.error||!role.data){setLoadError('Akun tidak punya hak admin Titiplen. Silakan login dengan akun admin.');setLoading(false);return;}
   }
   await load();
   setLoading(false);
  }catch(err){
   setLoadError(err instanceof Error?err.message:'Gagal memuat. Periksa koneksi internet.');
   setLoading(false);
  }
 }
 useEffect(()=>{
  setOnline(navigator.onLine);
  const goOnline=()=>setOnline(true),goOffline=()=>setOnline(false);
  window.addEventListener('online',goOnline);window.addEventListener('offline',goOffline);
  try{
   const s=sessionStorage.getItem(DRAFT_KEY);
   if(s){
     const draft=JSON.parse(s) as SavedDraft;
     if(draft.eventId)setEventId(draft.eventId);
     if(draft.customerId)setCustomerId(draft.customerId);
     if(draft.item&&typeof draft.item.product_name==='string')setItem(draft.item);
     if(draft.notes)setNotes(draft.notes);
     setPurchased(draft.purchased!==false);
   }
  }catch{/* Ignore malformed on-device draft. */}
  hydrated.current=true;
  void verify();
  return ()=>{window.removeEventListener('online',goOnline);window.removeEventListener('offline',goOffline);};
 },[]);
 useEffect(()=>{
  if(!hydrated.current)return;
  try{
   sessionStorage.setItem(DRAFT_KEY,JSON.stringify({eventId,customerId,item,notes,purchased} satisfies SavedDraft));
  }catch{/* Private browsing may disable storage. */}
 },[eventId,customerId,item,notes,purchased]);
 function setCustomer(id:string){setCustomerId(id);setNotice('');}
 function setEvent(id:string){setEventId(id);setNotice('');}

 async function addCustomer(e:FormEvent){
  e.preventDefault();setActionError('');setNotice('');
  const phone=normalizePhone(newCustomer.phone);
  if(!phone){setActionError('Nomor HP customer harus nomor Indonesia yang valid.');return;}
  if(newCustomer.name.trim().length<2){setActionError('Nama customer minimal 2 karakter.');return;}
  const match=data?.customers.find(c=>c.phone_e164===phone);
  if(match){setCustomer(match.id);setShowAddCustomer(false);setNotice('Customer sudah ada; otomatis dipilih.');return;}
  setSaving(true);
  try{
   let createdId='';
   if(isDemo)createdId=insertDemo('customers',{name:newCustomer.name.trim(),phone_e164:phone}).id;
   else{
    const r=await getSupabase().from('customers').insert({name:newCustomer.name.trim(),phone_e164:phone}).select('id').single();
    if(r.error)throw r.error;
    createdId=r.data.id;
   }
   await load();
   setCustomer(createdId);setCustomerSearch('');
   setNewCustomer({name:'',phone:''});setShowAddCustomer(false);
   setNotice('Customer ditambahkan. Sekarang lanjut catat barang.');
  }catch(err){setActionError(err instanceof Error?err.message:'Gagal menambah customer.');}
  finally{setSaving(false);}
 }
 async function addEvent(e:FormEvent){
  e.preventDefault();setActionError('');setNotice('');
  if(newEvent.name.trim().length<2){setActionError('Nama event minimal 2 karakter.');return;}
  setSaving(true);
  try{
   let createdId='';
   if(isDemo)createdId=insertDemo('events',{name:newEvent.name.trim(),event_date:newEvent.date||null,status:'Aktif'}).id;
   else{
    const r=await getSupabase().from('events').insert({name:newEvent.name.trim(),event_date:newEvent.date||null,status:'Aktif'}).select('id').single();
    if(r.error)throw r.error;
    createdId=r.data.id;
   }
   await load();setEvent(createdId);
   setNewEvent({name:'',date:new Date().toLocaleDateString('en-CA')});
   setShowAddEvent(false);setNotice('Event baru siap dipakai untuk pencatatan.');
  }catch(err){setActionError(err instanceof Error?err.message:'Gagal membuat event.');}
  finally{setSaving(false);}
 }

 async function save(e:FormEvent){
  e.preventDefault();
  setActionError('');setNotice('');
  if(!eventId||!customerId){setActionError('Pilih event dan customer dulu sebelum menyimpan barang.');return;}
  if(!data?.events.some(ev=>ev.id===eventId)||!data?.customers.some(c=>c.id===customerId)){
   setActionError('Event atau customer tidak ditemukan, coba muat ulang.');return;
  }
  if(!item.product_name.trim()){setActionError('Nama barang belum diisi.');return;}
  if(item.quantity<1||!Number.isSafeInteger(item.quantity)||item.quantity>9999){setActionError('Qty harus angka bulat dari 1 sampai 9.999.');return;}
  const numbers:[string,number][]=[
    ['modal',item.cost_unit],['fee',item.fee_unit],['add fee',item.extra_fee_unit],
    ['ongkir tagihan',item.shipping_charge],['ongkir aktual',item.shipping_cost],['diskon',item.discount]
  ];
  if(numbers.some(([_,v])=>!Number.isSafeInteger(v)||v<0)){
   setActionError('Ada nominal yang tidak valid.');return;
  }
  if(lineSales({...item,id:'',order_id:''})<0){setActionError('Diskon tidak boleh melebihi nilai barang dan biaya.');return;}
  if(!navigator.onLine){setActionError('HP sedang offline. Draft tetap di halaman ini, simpan setelah internet kembali.');return;}
  setSaving(true);
  try{
   const currentKey=keyRef.current;
   const prepared={...item,brand:item.brand.trim(),product_name:item.product_name.trim(),variant:item.variant.trim()};
   if(isDemo){
     const existing=readDemo().orders.some(o=>o.field_entry_key===currentKey);
     if(!existing){
       const order=insertDemo('orders',{customer_id:customerId,event_id:eventId,notes,field_entry_key:currentKey});
       insertDemo('order_items',{...prepared,order_id:order.id,purchase_status:purchased?'purchased':'planned',purchased_at:purchased?new Date().toISOString():null});
     }
   }else{
    const r=await getSupabase().rpc('create_titiplen_field_entry',{
      p_customer:customerId,p_event:eventId,p_notes:notes.trim(),p_item:prepared,
      p_purchase_status:purchased?'purchased':'planned',p_client_key:currentKey
    });
    if(r.error)throw r.error;
   }
   setLastSaved(item.product_name.trim());
   keyRef.current=uuid();
   setItem(emptyItem());setNotes('');setPurchased(true);setMore(false);
   try{sessionStorage.removeItem(DRAFT_KEY)}catch{}
   await load();
   setNotice('Berhasil! '+item.product_name.trim()+' sudah tersimpan di rekap '+selectedEvent?.name+'.');
   requestAnimationFrame(()=>itemRef.current?.focus());
  }catch(err){
   setActionError((err instanceof Error?err.message:'Gagal menyimpan barang.')+' Jika jaringan sempat putus, tekan Simpan lagi; sistem mencegah duplikasi.');
  }finally{setSaving(false);}
 }
 async function markPurchased(id:string){
  if(saving)return;
  setActionError('');setNotice('');setSaving(true);
  try{
   if(isDemo)updateItemPurchaseDemo(id);
   else{
     const r=await getSupabase().rpc('mark_titiplen_item_purchased',{p_item_id:id});
     if(r.error)throw r.error;
   }
   await load();
   setNotice('Barang ditandai sudah dibeli. Modal event ikut diperbarui.');
  }catch(err){setActionError(err instanceof Error?err.message:'Gagal memperbarui status.');}
  finally{setSaving(false);}
 }
 const customerFor=(id:string)=>data?.customers.find(c=>c.id===id)?.name||'Customer';
 if(loading)return <main className="field-load"><div className="spinner"/><p>Menyiapkan jurnal belanja Titiplen…</p></main>;
 if(loadError)return <main className="field-load"><h2>Tidak bisa membuka mode event</h2><p>{loadError}</p><Link className="button button-dark" href="/admin">Kembali ke login admin <ArrowRight size={16}/></Link></main>;
 return <div className="field-app">
   <header className="field-header">
     <div className="field-header-inner"><BrandMark compact/><Link href="/admin" className="field-back"><LayoutDashboard size={18}/><span>Dashboard</span></Link></div>
   </header>
   <main className="field-main">
     <div className="field-top"><div><span className="eyebrow">JURNAL JASTIP • LIVE EVENT</span><h1>Catat sambil belanja <span>♡</span></h1><p>Catat langsung dari HP. Satu barang tersimpan, lanjut ke barang berikutnya.</p></div><img src="/brand/titiplen-logo.webp" width="90" height="90" alt="Maskot Titiplen.id" className="field-mascot"/></div>
     {!online&&<div className="field-offline" role="status"><WifiOff size={18}/> Internet terputus. Draft tetap di layar ini, tetapi belum masuk database.</div>}
     {actionError&&<div className="inline-error" role="alert" style={{marginTop:12}}>{actionError}</div>}
     {notice&&<div className="inline-success" role="status" style={{marginTop:12}}><CheckCircle2 size={17} style={{verticalAlign:'middle',marginRight:7}}/>{notice}</div>}

     <section className="field-context">
       <div className="field-context-heading"><span className="field-step">01</span><strong>Pilih event & customer</strong></div>
       <div className="field-grid">
         <Field label="Event jastip">
           <select className="form-select field-touch" value={eventId} onChange={e=>setEvent(e.target.value)} required>
             <option value="">Pilih event...</option>
             {events.map(e=><option key={e.id} value={e.id}>{e.name} · {e.status}</option>)}
           </select>
         </Field>
         <Field label="Cari customer">
           <div className="field-search-wrap"><Search size={17}/><input className="form-input field-touch" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Nama / nomor HP" /></div>
         </Field>
         <Field label="Customer yang dititipkan">
           <select className="form-select field-touch" value={customerId} onChange={e=>setCustomer(e.target.value)} required>
             <option value="">{customerSearch?'Pilih hasil pencarian...':'Pilih customer...'}</option>
             {customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone_e164}</option>)}
             {selectedCustomer&&!customers.some(c=>c.id===selectedCustomer.id)&&<option value={selectedCustomer.id}>{selectedCustomer.name} (terpilih)</option>}
           </select>
         </Field>
         <div className="field-context-actions">
           <button type="button" className="field-text-action" onClick={()=>{setShowAddCustomer(!showAddCustomer);setShowAddEvent(false);setActionError('');}}><UserPlus size={17}/> Customer baru</button>
           <button type="button" className="field-text-action" onClick={()=>{setShowAddEvent(!showAddEvent);setShowAddCustomer(false);setActionError('');}}><Plus size={17}/> Event baru</button>
         </div>
       </div>
       {showAddCustomer&&<form onSubmit={addCustomer} className="field-embedded-form"><h3>Tambah customer saat di event</h3><div className="field-grid"><Field label="Nama lengkap"><input className="form-input field-touch" value={newCustomer.name} onChange={e=>setNewCustomer(v=>({...v,name:e.target.value}))} required maxLength={120}/></Field><Field label="WhatsApp / HP (08…)"><input className="form-input field-touch" value={newCustomer.phone} onChange={e=>setNewCustomer(v=>({...v,phone:e.target.value}))} inputMode="tel" required/></Field></div><div className="field-embedded-actions"><button type="button" className="button button-outline" onClick={()=>setShowAddCustomer(false)}>Batal</button><button className="button button-dark" disabled={saving}><Check size={16}/> Simpan customer</button></div></form>}
       {showAddEvent&&<form onSubmit={addEvent} className="field-embedded-form"><h3>Buat event baru</h3><div className="field-grid"><Field label="Nama event"><input className="form-input field-touch" value={newEvent.name} onChange={e=>setNewEvent(v=>({...v,name:e.target.value}))} required/></Field><Field label="Tanggal event"><input className="form-input field-touch" type="date" value={newEvent.date} onChange={e=>setNewEvent(v=>({...v,date:e.target.value}))}/></Field></div><div className="field-embedded-actions"><button type="button" className="button button-outline" onClick={()=>setShowAddEvent(false)}>Batal</button><button className="button button-dark" disabled={saving}><Check size={16}/> Simpan event</button></div></form>}
     </section>

     {eventId&&<section className="field-totals" aria-label="Ringkasan belanja event">
       <div><span>Sudah dibeli</span><strong>{completed.length} <small>barang</small></strong></div>
       <div><span>Belum dibeli</span><strong>{pending.length} <small>barang</small></strong></div>
       <div><span>Modal keluar*</span><strong>{idr(totalSpent)}</strong></div>
     </section>}
     <div className="field-tab-switch" role="tablist" aria-label="Mode catat dan rekap">
       <button type="button" role="tab" aria-selected={view==='write'} className={view==='write'?'active':''} onClick={()=>setView('write')}><Plus size={17}/> Catat barang</button>
       <button type="button" role="tab" aria-selected={view==='recap'} className={view==='recap'?'active':''} onClick={()=>setView('recap')}><BookOpenCheck size={17}/> Rekap event {eventId?'('+purchaseItems.length+')':''}</button>
     </div>
     {view==='write'&&<form className="field-form" onSubmit={save}>
       <div className="field-context-heading"><span className="field-step">02</span><strong>Barang yang sedang dibeli</strong></div>
       <div className="field-grid">
         <Field label="Brand"><input className="form-input field-touch" placeholder="Misalnya: Somethinc" value={item.brand} onChange={e=>changed('brand',e.target.value)} maxLength={120}/></Field>
         <Field label="Nama barang *"><input ref={itemRef} className="form-input field-touch" placeholder="Nama produk / barang" required value={item.product_name} onChange={e=>changed('product_name',e.target.value)} maxLength={250}/></Field>
         <Field label="Shade / size / varian"><input className="form-input field-touch" placeholder="Misalnya: Pink / XL" value={item.variant} onChange={e=>changed('variant',e.target.value)} maxLength={180}/></Field>
         <Field label="Jumlah / Qty"><div className="field-qty"><button type="button" aria-label="Kurangi jumlah" onClick={()=>changed('quantity',Math.max(1,item.quantity-1))}>−</button><input type="number" min="1" max="9999" step="1" inputMode="numeric" value={item.quantity} onChange={e=>changed('quantity',Math.max(1,Math.round(Number(e.target.value)||1)))}/><button type="button" aria-label="Tambah jumlah" onClick={()=>changed('quantity',Math.min(9999,item.quantity+1))}>+</button></div></Field>
         <Field label="Modal beli per pcs (Rp)"><Money value={item.cost_unit} onChange={v=>changed('cost_unit',v)}/></Field>
         <Field label="Fee jastip per pcs (Rp)"><Money value={item.fee_unit} onChange={v=>changed('fee_unit',v)}/></Field>
       </div>
       <details className="field-extras" open={more} onToggle={e=>setMore(e.currentTarget.open)}>
         <summary>Biaya tambahan & catatan <ChevronDown size={17}/></summary>
         <div className="field-grid">
           <Field label="Add fee per pcs (Rp)"><Money value={item.extra_fee_unit} onChange={v=>changed('extra_fee_unit',v)}/></Field>
           <Field label="Ongkir ditagihkan (Rp)"><Money value={item.shipping_charge} onChange={v=>changed('shipping_charge',v)}/></Field>
           <Field label="Ongkir aktual Titiplen (Rp)"><Money value={item.shipping_cost} onChange={v=>changed('shipping_cost',v)}/></Field>
           <Field label="Diskon total (Rp)"><Money value={item.discount} onChange={v=>changed('discount',v)}/></Field>
           <div className="field-wide"><Field label="Catatan internal (opsional)"><textarea className="form-textarea" rows={2} maxLength={500} placeholder="Contoh: struk #13, lokasi booth..." value={notes} onChange={e=>{setNotes(e.target.value);keyRef.current=uuid();}}/></Field></div>
         </div>
       </details>
       <div className="field-status-select" role="group" aria-label="Status pembelian">
         <span>Status barang</span>
         <div><button type="button" className={purchased?'selected':''} aria-pressed={purchased} onClick={()=>{setPurchased(true);keyRef.current=uuid();}}><Check size={16}/> Sudah dibeli</button>
         <button type="button" className={!purchased?'selected later':''} aria-pressed={!purchased} onClick={()=>{setPurchased(false);keyRef.current=uuid();}}><Clock3 size={16}/> Belum dibeli</button></div>
       </div>
       <div className="field-preview">
         <div><span>Estimasi harga jual</span><strong>{idr(lineSales({...item,id:'',order_id:''}))}</strong></div>
         <div><span>Modal termasuk ongkir aktual</span><strong>{idr(lineCost({...item,id:'',order_id:''}))}</strong></div>
         <div className="field-preview-last"><span>Estimasi laba barang</span><strong style={{color:lineProfit({...item,id:'',order_id:''})<0?'#AD4561':'#28765A'}}>{idr(lineProfit({...item,id:'',order_id:''}))}</strong></div>
       </div>
       <p className="field-helper">{online?<><Cloud size={15}/> Disimpan langsung ke database Titiplen saat tombol ditekan. Draft di tab ini tersimpan sementara.</>:<><CloudOff size={15}/> Sedang offline — jangan tutup tab sebelum internet kembali.</>}</p>
       <div className="field-save-bar"><div><strong>{selectedCustomer?.name||'Pilih customer'}</strong><span>{selectedEvent?.name||'Pilih event'}</span></div><button disabled={saving||!eventId||!customerId||!item.product_name.trim()||!online} className="button button-dark field-primary-save"><Save size={19}/>{saving?'Menyimpan…':'Simpan & lanjut'}</button></div>
       {lastSaved&&<div className="field-last-saved"><CheckCircle2 size={16}/> Terakhir disimpan: {lastSaved}</div>}
     </form>}
     {view==='recap'&&<section className="field-recap">
       <div className="field-context-heading"><span className="field-step">03</span><strong>Rekap {selectedEvent?.name||'event'}</strong><button type="button" className="field-refresh" onClick={()=>void load().catch(err=>setActionError(err instanceof Error?err.message:'Gagal memuat ulang'))}><RefreshCw size={15}/> Refresh</button></div>
       {!eventId?<p className="notice">Pilih event dulu untuk melihat barang yang sudah dicatat.</p>:
       purchaseItems.length===0?<div className="empty-state"><ShoppingBag/><strong>Belum ada barang</strong><p>Mulai dengan tombol Catat barang di atas.</p></div>:
       <><div className="field-recap-summary"><span>Modal barang sudah dibeli: <strong>{idr(totalSpent)}</strong></span><span>Perkiraan nilai jual barang dibeli: <strong>{idr(expectedSales)}</strong></span></div>
       <div className="field-recap-list">{purchaseItems.map(({line,order})=><article className="field-item-card" key={line.id}>
        <div className="field-item-head"><Status purchased={line.purchase_status!=='planned'}/><span className="field-item-date">{shortDate(order.created_at)}</span></div>
        <h3>{line.brand?line.brand+' · ':''}{line.product_name}</h3>
        <p>{line.variant||'Tanpa varian'} · {line.quantity} pcs · <strong>{customerFor(order.customer_id)}</strong></p>
        <div className="field-item-money"><span>Modal {idr(lineCost(line))}</span><strong>Jual {idr(lineSales(line))}</strong></div>
        {line.purchase_status==='planned'&&<button type="button" className="button button-mint field-mark" disabled={saving} onClick={()=>void markPurchased(line.id)}><CheckCircle2 size={17}/> Tandai sudah dibeli</button>}
       </article>)}</div></>}
       <p className="field-helper">* Modal keluar dihitung dari barang berstatus sudah dibeli. Biaya event lain dan pembayaran customer dipantau terpisah di Dashboard Admin.</p>
     </section>}
     <footer className="field-footer">Titiplen.id · Jurnal belanja event · {isDemo?'Mode demo':'Tersinkron dengan database'}</footer>
   </main>
   <nav className="field-bottom-nav" aria-label="Navigasi khusus HP">
     <Link href="/admin"><Home size={20}/><span>Dashboard</span></Link>
     <button type="button" aria-current={view==='write'?'page':undefined} onClick={()=>{setView('write');window.scrollTo({top:0,behavior:'smooth'});}}><Plus size={21}/><span>Catat</span></button>
     <button type="button" aria-current={view==='recap'?'page':undefined} onClick={()=>{setView('recap');window.scrollTo({top:0,behavior:'smooth'});}}><ReceiptText size={20}/><span>Rekap</span></button>
   </nav>
 </div>;
}
