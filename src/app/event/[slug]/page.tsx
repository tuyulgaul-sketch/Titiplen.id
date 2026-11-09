'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useParams,useRouter} from 'next/navigation';
import {getSupabase} from '@/lib/supabase';
import {ArrowLeft,Camera,CheckCircle2,Plus,ShoppingBag,Trash2} from 'lucide-react';
import '../../open-order.css';

type EventInfo={id:string;name:string;event_date:string|null};
type Line={id:string;product_name:string;variant:string;notes:string;quantity:number;file:File|null};
const initial=():Line=>({id:crypto.randomUUID(),product_name:'',variant:'',notes:'',quantity:1,file:null});
const createEmpty=():Line=>({id:'first',product_name:'',variant:'',notes:'',quantity:1,file:null});
export default function PublicEventPage(){
 const params=useParams<{slug:string}>();
 const router=useRouter();
 const [event,setEvent]=useState<EventInfo|null>(null);
 const [loading,setLoading]=useState(true);
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [lines,setLines]=useState<Line[]>([createEmpty()]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const requestKey=useRef('');
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const {data,error}=await getSupabase().from('events')
     .select('id,name,event_date').eq('open_order_slug',params.slug)
     .eq('open_order_enabled',true).eq('status','Aktif').maybeSingle();
    if(error)throw error;
    if(active)setEvent(data);
   }catch(e){if(active)setError(e instanceof Error?e.message:'Gagal membuka event');}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false};
 },[params.slug]);
 function change(id:string,patch:Partial<Line>){setLines(old=>old.map(item=>item.id===id?{...item,...patch}:item));}
 async function submit(e:FormEvent){
  e.preventDefault();setError('');
  if(!lines.every(i=>i.file&&i.product_name.trim().length>=2)){
   setError('Setiap barang wajib punya nama dan foto/screenshot.');return;
  }
  if(lines.reduce((n,i)=>n+(i.file?.size||0),0)>12582912){setError('Total semua gambar maksimal 12 MB. Kompres gambar terlebih dahulu.');return;}
  if(!requestKey.current)requestKey.current=crypto.randomUUID();
  setBusy(true);
  try{
   const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
   const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   if(!url||!key)throw new Error('Sistem pemesanan belum diaktifkan oleh admin');
   const data=new FormData();
   data.set('client_key',requestKey.current);
   data.set('event_slug',params.slug);
   data.set('customer_name',name.trim());
   data.set('phone',phone.trim());
   data.set('website','');
   data.set('items',JSON.stringify(lines.map(i=>({
    product_name:i.product_name.trim(),variant:i.variant.trim(),notes:i.notes.trim(),quantity:i.quantity
   }))));
   lines.forEach((i,index)=>{if(i.file)data.set('image_'+index,i.file)});
   const response=await fetch(url+'/functions/v1/jastip-public',{
    method:'POST',headers:{apikey:key},body:data
   });
   const result=await response.json();
   if(!response.ok||!result.token)throw new Error(result.error||'Gagal mengirim pesanan');
   try{
    sessionStorage.setItem('titiplen.last.order.phone',phone.trim());
    const storageKey='titiplen.open.receipts.v1';
    const existing=JSON.parse(localStorage.getItem(storageKey)||'[]') as {token:string}[];
    const saved=[{token:result.token,invoice_number:result.invoice_number,event_name:event?.name||'',created_at:new Date().toISOString()},...existing.filter(x=>x.token!==result.token)].slice(0,40);
    localStorage.setItem(storageKey,JSON.stringify(saved));
   }catch{ /* Device storage is optional; the direct invoice URL still works. */ }
   router.push('/pesanan/'+encodeURIComponent(result.token));
  }catch(err){setError(err instanceof Error?err.message:'Gagal mengirim pesanan. Coba lagi.');}
  finally{setBusy(false);}
 }
 return <main className="oo-page"><div className="oo-shell" style={{maxWidth:760}}>
  <header className="oo-header">
   <Link href="/" className="oo-brand">titiplen.id ♡<small>Jastip tanpa ribet</small></Link>
   <Link href="/" className="oo-back"><ArrowLeft size={14} style={{display:'inline'}}/> Beranda</Link>
  </header>
  {loading?<div className="oo-card">Memuat event…</div>:!event?
   <div className="oo-card"><h2>Event tidak tersedia</h2><p className="oo-muted">Link salah atau event sudah ditutup. Minta link baru ke admin Titiplen.</p>{error&&<p className="oo-message error">{error}</p>}</div>:
   <>
    <div className="oo-card" style={{background:'linear-gradient(135deg,#fff,#fff0f6)'}}>
     <span className="oo-pill"><CheckCircle2 size={13}/> OPEN ORDER</span>
     <h1 className="oo-title">{event.name}</h1>
     <p className="oo-muted">Pilih barang dari foto atau postingan Titiplen, lalu upload screenshot masing-masing barang. Kamu bisa pesan beberapa barang sekaligus.</p>
     {event.event_date&&<div className="oo-small" style={{color:'#a24b7d'}}>Tanggal event: {new Date(event.event_date+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div>}
    </div>
    <form onSubmit={submit} className="oo-section">
     <section className="oo-card">
      <h2>Data pemesan</h2>
      <p className="oo-muted">Tidak perlu membuat akun. Nomor WhatsApp dipakai admin jika perlu konfirmasi.</p>
      <label className="oo-label" htmlFor="oo-name">Nama customer</label>
      <input id="oo-name" className="oo-input" placeholder="Nama lengkap" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={120} required/>
      <label className="oo-label" htmlFor="oo-phone">Nomor WhatsApp</label>
      <input id="oo-phone" className="oo-input" type="tel" inputMode="tel" placeholder="08xxxxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)} minLength={10} maxLength={20} required/>
     </section>
     <section className="oo-card oo-section">
      <div className="oo-between"><div><h2>Barang yang dititip</h2><p className="oo-muted">Maksimal 8 barang per submit.</p></div><span className="oo-counter">{lines.length} barang</span></div>
      {lines.map((line,index)=><div className="oo-item" key={line.id}>
       <div className="oo-between"><strong>Barang {index+1}</strong>{lines.length>1&&<button type="button" className="oo-button" style={{padding:'6px 10px'}} onClick={()=>setLines(items=>items.filter(i=>i.id!==line.id))}><Trash2 size={14}/> Hapus</button>}</div>
       <label className="oo-label">Foto / screenshot barang *</label>
       <div className="oo-file"><label style={{cursor:'pointer',display:'block'}}>
        <span className="oo-row"><Camera size={19} color="#af3473"/><span className="oo-muted">{line.file?line.file.name:'Pilih foto barang (JPG, PNG, WebP maks. 3 MB)'}</span></span>
        <input type="file" accept="image/png,image/jpeg,image/webp" required={!line.file}
         style={{maxWidth:'100%',fontSize:12,marginTop:8}} onChange={e=>{
          const f=e.target.files?.[0]||null;
          if(f&&f.size>3145728){setError('Maksimum ukuran gambar adalah 3 MB per barang.');e.target.value='';return;}
          change(line.id,{file:f});setError('');
         }}/>
       </label></div>
       <label className="oo-label">Nama barang *</label>
       <input className="oo-input" placeholder="Misal: Tas Zara model shoulder bag" value={line.product_name}
        onChange={e=>change(line.id,{product_name:e.target.value})} minLength={2} maxLength={160} required/>
       <div className="oo-grid">
        <div><label className="oo-label">Ukuran / warna / varian</label><input className="oo-input" placeholder="Size M / hitam" value={line.variant} maxLength={160} onChange={e=>change(line.id,{variant:e.target.value})}/></div>
        <div><label className="oo-label">Jumlah</label><input className="oo-input" type="number" min={1} max={20} value={line.quantity} onChange={e=>change(line.id,{quantity:Number(e.target.value)})} required/></div>
       </div>
       <label className="oo-label">Catatan tambahan (opsional)</label>
       <textarea className="oo-input" rows={2} value={line.notes} maxLength={500} placeholder="Link postingan, prioritas warna, dll." onChange={e=>change(line.id,{notes:e.target.value})}/>
      </div>)}
      <button className="oo-button" type="button" disabled={lines.length>=8||busy} onClick={()=>setLines(old=>[...old,initial()])} style={{width:'100%',marginTop:12}}><Plus size={16}/> Tambah barang</button>
     </section>
     <section className="oo-card oo-section">
      <div className="oo-message info">Setelah dikirim, seluruh barang langsung masuk daftar purchase order admin dengan status <b>Menunggu</b>. Admin akan mengonfirmasi apakah barang berhasil didapat dan harga finalnya.</div>
      {error&&<div className="oo-message error">{error}</div>}
      <button className="oo-button main" type="submit" disabled={busy} style={{width:'100%',marginTop:10}}><ShoppingBag size={17}/>{busy?'Mengunggah foto & menyimpan…':'Kirim pesanan'}</button>
      <p className="oo-muted" style={{textAlign:'center',marginTop:12}}>Tidak perlu login • Simpan link invoice yang muncul setelah submit</p>
     </section>
    </form>
   </>
  }
 </div></main>;
}