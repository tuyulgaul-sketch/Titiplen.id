'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ReceiptText} from 'lucide-react';
import '../open-order.css';
type Saved={token:string;invoice_number:string;event_name:string;created_at:string};
const KEY='titiplen.open.receipts.v1';
export default function MyOrders(){
 const [receipts,setReceipts]=useState<Saved[]>([]);
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(value))setReceipts(value.filter(x=>x&&typeof x.token==='string'));}catch{}},[]);
 return <main className="oo-page"><div className="oo-shell" style={{maxWidth:760}}>
  <header className="oo-header"><Link href="/" className="oo-brand">titiplen.id ♡<small>Riwayat di perangkat ini</small></Link><Link href="/" className="oo-back"><ArrowLeft size={14} style={{display:'inline'}}/> Beranda</Link></header>
  <div className="oo-card"><span className="oo-pill"><ReceiptText size={13}/> TANPA LOGIN</span><h1 className="oo-title">Pesanan saya</h1>
   <p className="oo-muted">Ini adalah link invoice yang pernah dibuat dari browser/perangkat ini, bukan daftar berdasarkan nomor WhatsApp. Simpan link pribadimu; jika berganti perangkat atau menghapus data browser, riwayat ini tidak tersedia.</p>
   <Link href="/event" className="oo-button main" style={{marginTop:12}}>Lihat event buka order <ArrowRight size={15}/></Link>
  </div>
  <div className="oo-section">
   {receipts.length===0?<div className="oo-card"><h2>Belum ada pesanan tersimpan</h2><p className="oo-muted">Setelah mengisi form event, invoice otomatis tersimpan di browser ini.</p></div>:receipts.map(r=>
    <Link href={'/pesanan/'+encodeURIComponent(r.token)} key={r.token} className="oo-card oo-between" style={{display:'flex',marginBottom:12,textDecoration:'none',color:'inherit'}}>
     <div><span className="oo-pill">INVOICE</span><h2 style={{marginTop:8}}>{r.invoice_number}</h2><div className="oo-muted">{r.event_name} · {new Date(r.created_at).toLocaleDateString('id-ID')}</div></div><ArrowRight size={20} color="#b44380"/>
    </Link>
   )}
  </div>
 </div></main>;
}