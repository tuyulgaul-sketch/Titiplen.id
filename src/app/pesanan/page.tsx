'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,ClipboardCheck,MapPin,Package,ReceiptText,RefreshCw,ShoppingBag,Truck} from 'lucide-react';
import '../open-order.css';

type Method='shopee'|'manual';
type Item={id:string;product_name:string;variant:string;quantity:number;status:'pending'|'found'|'not_found';final_unit_price:number;total:number;admin_note:string};
type Invoice={id:string;invoice_number:string;event_name:string;event_id:string;created_at:string;items:Item[];total:number;pending:number;found:number;final:boolean;method_choice:{method:string;status:string}|null;shopee_checkout_url:string|null};
type Saved={token:string;invoice_number:string;event_name:string;created_at:string};
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const labels={pending:'Menunggu',found:'Didapat',not_found:'Tidak didapat'};
const endpoint=()=>{const base=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!base||!key)throw new Error('Sistem invoice belum dikonfigurasi');return {url:base+'/functions/v1/jastip-invoices',key};};
async function request(body:Record<string,unknown>){
 const {url,key}=endpoint();
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',apikey:key},body:JSON.stringify(body),cache:'no-store'});
 const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Permintaan gagal');return payload;
}
function ShippingForm({invoice,phone,onSaved}:{invoice:Invoice;phone:string;onSaved:()=>Promise<void>}){
 const [method,setMethod]=useState<Method>('shopee');
 const [recipientName,setRecipientName]=useState('');
 const [recipientPhone,setRecipientPhone]=useState('');
 const [address,setAddress]=useState('');
 const [notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState(false);
 const [checkoutUrl,setCheckoutUrl]=useState<string|null>(null);
 async function submit(e:FormEvent){
  e.preventDefault();setError('');setBusy(true);
  try{
   const result=await request({action:'delivery',phone,invoice_id:invoice.id,method,
    recipient_name:method==='manual'?recipientName:undefined,
    recipient_phone:method==='manual'?recipientPhone:undefined,
    recipient_address:method==='manual'?address:undefined,notes,website:''});
   setSuccess(true);setCheckoutUrl(result.shopee_checkout_url||null);
   await onSaved().catch(()=>{});
  }catch(err){setError(err instanceof Error?err.message:'Gagal mengirim pilihan');}
  finally{setBusy(false);}
 }
 return <div className="oo-section">
  <h3>Pilih cara terima barang</h3>
  {invoice.method_choice&&<div className="oo-message info">Pengajuan terakhir: <b>{invoice.method_choice.method==='shopee'?'Checkout Shopee':'Kirim Manual'}</b> · {invoice.method_choice.status==='approved'?'Sudah dikonfirmasi admin':'Menunggu verifikasi admin'}. Jika ada kesalahan, hubungi admin Titiplen.</div>}
  {success?<div className="oo-message success"><CheckCircle2 size={16} style={{display:'inline',verticalAlign:'middle'}}/> Pilihan pengiriman tersimpan. Admin akan memeriksanya.
   {method==='shopee'&&(checkoutUrl?<div style={{marginTop:12}}><a className="oo-button main" href={checkoutUrl} target="_blank" rel="noopener noreferrer">Buka link Shopee <ArrowRight size={15}/></a></div>:<div style={{marginTop:5}}>Link Shopee belum disiapkan. Admin akan memberikan instruksi checkout.</div>)}
  </div>:invoice.method_choice?.status==='approved'?<div className="oo-message success">Metode pengiriman sudah dikonfirmasi admin. Hubungi admin jika perlu perubahan.</div>:
  <form onSubmit={submit}>
   <div className="oo-grid">
    <button type="button" className={'oo-button '+(method==='shopee'?'main':'')} onClick={()=>setMethod('shopee')} style={{width:'100%'}}><ShoppingBag size={16}/> Checkout Shopee</button>
    <button type="button" className={'oo-button '+(method==='manual'?'main':'')} onClick={()=>setMethod('manual')} style={{width:'100%'}}><Truck size={16}/> Kirim Manual</button>
   </div>
   {method==='manual'&&<div style={{marginTop:14}}>
    <label className="oo-label">Nama penerima *</label><input className="oo-input" required minLength={2} maxLength={120} placeholder="Nama lengkap penerima" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/>
    <label className="oo-label">Nomor HP penerima *</label><input className="oo-input" required type="tel" placeholder="08xxxxxxxx" value={recipientPhone} onChange={e=>setRecipientPhone(e.target.value)}/>
    <label className="oo-label">Alamat lengkap *</label><textarea className="oo-input" required rows={4} minLength={15} maxLength={1000} placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota, provinsi, kode pos" value={address} onChange={e=>setAddress(e.target.value)}/>
   </div>}
   <label className="oo-label">Catatan (opsional)</label><textarea className="oo-input" rows={2} maxLength={500} placeholder={method==='shopee'?'Contoh: akun Shopee yang akan digunakan':'Contoh: patokan rumah, titip satpam'} value={notes} onChange={e=>setNotes(e.target.value)}/>
   <p className="oo-muted" style={{marginTop:10}}>Tanpa OTP, pengajuan ini <strong>harus diverifikasi admin</strong> sebelum barang dikirim. Detail alamat hanya ditampilkan kepada admin.</p>
   {error&&<div className="oo-message error">{error}</div>}
   <button className="oo-button main" type="submit" disabled={busy} style={{width:'100%',marginTop:12}}>
    {busy?'Mengirim…':method==='shopee'?'Pilih Checkout Shopee':'Simpan Alamat Pengiriman'}
   </button>
  </form>}
 </div>;
}
function InvoiceCard({invoice,phone,onSaved}:{invoice:Invoice;phone:string;onSaved:()=>Promise<void>}){
 const [expanded,setExpanded]=useState(true);
 return <section className="oo-card" style={{marginTop:14}}>
  <div className="oo-between">
   <div><span className="oo-pill">INVOICE EVENT</span><h2 style={{marginTop:8}}>{invoice.event_name}</h2>
    <p className="oo-muted">{invoice.invoice_number} · {invoice.items.length} barang</p></div>
   <div style={{textAlign:'right'}}><div className="oo-money">{money(invoice.total)}</div>
    <span className={'oo-pill '+(invoice.final?'found':'pending')}>{invoice.final?'Harga final':'Masih diproses'}</span></div>
  </div>
  <button type="button" className="oo-button" style={{marginTop:12,width:'100%'}} onClick={()=>setExpanded(v=>!v)}>{expanded?'Tutup rincian':'Lihat rincian barang'}</button>
  {expanded&&<div style={{marginTop:12}}>
   {invoice.items.map(item=><div key={item.id} className="oo-invoice-line">
    <div style={{flex:1,minWidth:0}}><strong>{item.product_name}</strong>
     <div className="oo-muted">{item.quantity} pcs{item.variant?' · '+item.variant:''}</div>
     <span className={'oo-pill '+item.status} style={{marginTop:6}}>{labels[item.status]}</span>
     {item.status==='not_found'&&<div className="oo-muted">Histori saja, tidak masuk tagihan.</div>}
     {item.admin_note&&<div className="oo-muted">Catatan: {item.admin_note}</div>}
    </div>
    <div style={{minWidth:90,textAlign:'right'}}><b>{money(item.total)}</b>{item.status==='found'&&<div className="oo-muted">{money(item.final_unit_price)}/pcs</div>}</div>
   </div>)}
   <div className="oo-summary" style={{marginTop:14}}>
    <div className="oo-between"><strong>Total invoice</strong><div className="oo-money">{money(invoice.total)}</div></div>
    <div className="oo-muted">Item yang tidak didapat atau masih menunggu dihitung Rp0.</div>
   </div>
   {invoice.final&&invoice.found>0?<ShippingForm key={invoice.id} invoice={invoice} phone={phone} onSaved={onSaved}/>:
    <div className="oo-message info" style={{marginTop:14}}>{invoice.pending>0?
     'Pengiriman bisa dipilih setelah semua barang selesai dikonfirmasi oleh admin.':
     'Seluruh barang tidak berhasil didapat. Tidak ada barang untuk dikirim.'}</div>}
  </div>}
 </section>;
}
export default function MyOrders(){
 const [phone,setPhone]=useState('');
 const [searchedPhone,setSearchedPhone]=useState('');
 const [invoices,setInvoices]=useState<Invoice[]>([]);
 const [saved,setSaved]=useState<Saved[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [searched,setSearched]=useState(false);
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem('titiplen.open.receipts.v1')||'[]');if(Array.isArray(v))setSaved(v.filter(x=>x&&typeof x.token==='string'));}catch{}},[]);
 async function lookup(value:string){
  setBusy(true);setError('');
  try{const result=await request({action:'lookup',phone:value,website:''});
   setInvoices(result.invoices||[]);setSearchedPhone(value);setSearched(true);
  }catch(err){setError(err instanceof Error?err.message:'Gagal mencari invoice');}
  finally{setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();void lookup(phone);}
 return <main className="oo-page"><div className="oo-shell" style={{maxWidth:800}}>
  <header className="oo-header"><Link href="/" className="oo-brand">titiplen.id ♡<small>Invoice Saya · Tanpa Login</small></Link><Link href="/" className="oo-back"><ArrowLeft size={14} style={{display:'inline'}}/> Beranda</Link></header>
  <div className="oo-card">
   <span className="oo-pill"><ReceiptText size={13}/> INVOICE SAYA</span><h1 className="oo-title">Cek invoice jastip kamu</h1>
   <p className="oo-muted">Masukkan nomor WhatsApp yang dipakai saat mengisi form order. Jika ikut dua event, invoice muncul terpisah per event. Tidak perlu akun atau OTP.</p>
   <form onSubmit={submit}>
    <label className="oo-label" htmlFor="phone-lookup">Nomor WhatsApp customer</label>
    <div className="oo-row"><input id="phone-lookup" className="oo-input" style={{flex:1,minWidth:190}} type="tel" inputMode="tel" placeholder="08xxxxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)} required minLength={10}/><button className="oo-button main" disabled={busy}>{busy?'Mencari…':'Cek Invoice'} <ArrowRight size={15}/></button></div>
   </form>
   <p className="oo-muted" style={{marginTop:12}}>Catatan privasi: tanpa OTP, siapa pun yang mengetahui nomor dapat melihat informasi invoice terbatas. Nama dan alamat penerima tidak ditampilkan di hasil pencarian.</p>
   {error&&<div className="oo-message error">{error}</div>}
  </div>
  {searched&&<section className="oo-section">
   <div className="oo-between"><div><h2 className="oo-title" style={{fontSize:21,margin:0}}>Invoice kamu ({invoices.length} event)</h2><p className="oo-muted">Setiap event dihitung dan ditampilkan terpisah.</p></div><button className="oo-button" disabled={busy} onClick={()=>void lookup(searchedPhone)}><RefreshCw size={15}/> Perbarui</button></div>
   {invoices.length===0?<div className="oo-card oo-section"><h3>Belum ada invoice</h3><p className="oo-muted">Pastikan nomor WhatsApp sama dengan yang digunakan saat submit pesanan.</p></div>:
    invoices.map(i=><InvoiceCard key={i.id} invoice={i} phone={searchedPhone} onSaved={()=>lookup(searchedPhone)}/>)}
  </section>}
  {saved.length>0&&<section className="oo-card oo-section"><h3>Link invoice yang pernah dibuka di HP ini</h3>
   <p className="oo-muted">Daftar pribadi di browser ini. Bisa dipakai jika ingin membuka link yang diterima setelah submit.</p>
   {saved.map(s=><Link key={s.token} className="oo-invoice-line" href={'/pesanan/'+encodeURIComponent(s.token)} style={{display:'flex',color:'inherit',textDecoration:'none'}}>
    <span><strong>{s.event_name||'Event Titiplen'}</strong><div className="oo-muted">{s.invoice_number}</div></span><ArrowRight size={17} color="#ae3472"/></Link>)}
  </section>}
  <div className="oo-section" style={{textAlign:'center'}}><Link href="/event" className="oo-button"><ShoppingBag size={15}/> Lihat event open order</Link></div>
 </div></main>;
}