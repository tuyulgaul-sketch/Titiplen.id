'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ArrowLeft,CheckCircle2,Clock3,Copy,RefreshCw,ReceiptText} from 'lucide-react';
import '../../open-order.css';

type Item={id:string;product_name:string;variant:string;notes:string;quantity:number;status:'pending'|'found'|'not_found';final_unit_price:number;line_total:number;admin_note:string};
type Receipt={invoice_number:string;customer_name:string;event_name:string;created_at:string;items:Item[];total:number;final:boolean};
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const labels={pending:'Menunggu konfirmasi',found:'Berhasil didapat',not_found:'Tidak didapat'};
export default function ReceiptPage(){
 const {token}=useParams<{token:string}>();
 const [data,setData]=useState<Receipt|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [copied,setCopied]=useState(false);
 async function reload(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key){setError('Layanan belum dikonfigurasi');setLoading(false);return;}
  try{
   const response=await fetch(url+'/functions/v1/jastip-public?token='+encodeURIComponent(token),{
    headers:{apikey:key},cache:'no-store'
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Invoice gagal dimuat');
   setData(result);setError('');
  }catch(err){setError(err instanceof Error?err.message:'Gagal memuat invoice');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void reload();const timer=setInterval(()=>{if(document.visibilityState==='visible')void reload()},15000);return()=>clearInterval(timer);},[token]);
 async function copy(){
  await navigator.clipboard.writeText(window.location.href);setCopied(true);
  setTimeout(()=>setCopied(false),2000);
 }
 return <main className="oo-page"><div className="oo-shell" style={{maxWidth:790}}>
  <header className="oo-header"><Link href="/" className="oo-brand">titiplen.id ♡<small>Detail pesanan kamu</small></Link><Link href="/" className="oo-back"><ArrowLeft size={14} style={{display:'inline'}}/> Beranda</Link></header>
  {loading?<div className="oo-card">Memuat invoice kamu…</div>:error&&!data?<div className="oo-card"><h2>Invoice tidak tersedia</h2><div className="oo-message error">{error}</div></div>:data&&<>
   <div className="oo-card">
    <span className="oo-pill"><ReceiptText size={13}/> INVOICE JASTIP</span>
    <h1 className="oo-title">{data.invoice_number}</h1>
    <div className="oo-muted">{data.customer_name} · {data.event_name}</div>
    <div className="oo-muted">Dibuat {new Date(data.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</div>
    <div className="oo-message info">
     {data.final?<><CheckCircle2 size={15} style={{display:'inline',verticalAlign:'middle'}}/> Semua barang sudah dikonfirmasi. Total di bawah adalah tagihan barang yang berhasil didapat.</>:
     <><Clock3 size={15} style={{display:'inline',verticalAlign:'middle'}}/> Pesanan sedang diproses. Total dapat berubah saat admin mengonfirmasi barang dan harga final.</>}
    </div>
    <div className="oo-between"><h2 style={{margin:0}}>Daftar barang</h2><span className="oo-counter">{data.items.length} barang</span></div>
    <div style={{marginTop:12}}>
     {data.items.map((item,index)=><div key={item.id} className="oo-invoice-line">
      <div style={{flex:1,minWidth:0}}>
       <div className="oo-small" style={{color:'#98798a'}}>#{index+1} · {item.quantity} pcs</div>
       <strong>{item.product_name}</strong>
       {item.variant&&<div className="oo-muted">{item.variant}</div>}
       <div style={{marginTop:5}}><span className={'oo-pill '+item.status}>{labels[item.status]}</span></div>
       {item.status==='not_found'&&<div className="oo-muted" style={{marginTop:5}}>Tetap tercatat sebagai histori; tidak masuk tagihan.</div>}
       {item.admin_note&&<div className="oo-muted" style={{marginTop:5}}>{item.admin_note}</div>}
      </div>
      <div style={{textAlign:'right',minWidth:96}}><strong>{money(item.line_total)}</strong>{item.status==='found'&&<div className="oo-muted">{money(item.final_unit_price)}/pcs</div>}</div>
     </div>)}
    </div>
    <div className="oo-summary" style={{marginTop:18}}>
     <div className="oo-between"><strong>Total tagihan sementara</strong><span className="oo-money">{money(data.total)}</span></div>
     <div className="oo-muted">Barang belum didapat / tidak didapat otomatis bernilai Rp0.</div>
    </div>
    <div className="oo-row" style={{marginTop:18}}>
     <button type="button" className="oo-button main" onClick={()=>void copy()}><Copy size={16}/>{copied?'Link disalin':'Salin link invoice'}</button>
     <button type="button" className="oo-button" onClick={()=>void reload()}><RefreshCw size={16}/> Perbarui status</button>
    </div>
    {error&&<div className="oo-message error">{error}</div>}
   </div>
   <div className="oo-card oo-section"><h3>Simpan link ini ya ♡</h3><p className="oo-muted">Tidak perlu login. Link ini bersifat pribadi dan dapat dibuka kembali untuk melihat update status. Jangan bagikan kepada orang lain karena berisi informasi pesanan kamu. Status diperbarui otomatis setiap 15 detik saat halaman aktif.</p></div>
  </>}
 </div></main>;
}