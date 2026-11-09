'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CalendarDays,ShoppingBag} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';
import '../open-order.css';
type Event={id:string;name:string;event_date:string|null;open_order_slug:string};
export default function ActiveEventList(){
 const [events,setEvents]=useState<Event[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  getSupabase().from('events').select('id,name,event_date,open_order_slug')
   .eq('status','Aktif').eq('open_order_enabled',true)
   .order('created_at',{ascending:false})
   .then(({data,error})=>{if(error)setError(error.message);else setEvents(data||[]);setLoading(false);});
 },[]);
 return <main className="oo-page"><div className="oo-shell" style={{maxWidth:780}}>
  <header className="oo-header"><Link href="/" className="oo-brand">titiplen.id ♡<small>Jastip tanpa ribet</small></Link><Link href="/" className="oo-back"><ArrowLeft size={14} style={{display:'inline'}}/> Beranda</Link></header>
  <div className="oo-card"><span className="oo-pill"><ShoppingBag size={13}/> EVENT JASTIP</span><h1 className="oo-title">Mau titip dari event mana?</h1>
   <p className="oo-muted">Pilih event yang sedang open order, upload screenshot barang pilihanmu, dan pesanan akan langsung masuk daftar admin. Tanpa perlu login.</p>
  </div>
  {error&&<div className="oo-message error">{error}</div>}
  <section className="oo-section">
   {loading?<div className="oo-card">Memuat event…</div>:events.length===0?<div className="oo-card"><h2>Belum ada event yang buka order</h2><p className="oo-muted">Event baru akan muncul di sini saat admin Titiplen mengaktifkannya.</p></div>:
    events.map(e=><Link href={'/event/'+e.open_order_slug} className="oo-card oo-between" key={e.id} style={{display:'flex',textDecoration:'none',color:'inherit',marginBottom:12}}>
     <div><span className="oo-pill">OPEN ORDER</span><h2 style={{marginTop:9}}>{e.name}</h2><div className="oo-muted"><CalendarDays size={14} style={{display:'inline',verticalAlign:'middle'}}/> {e.event_date?new Date(e.event_date+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):'Tanggal menyusul'}</div></div>
     <ArrowRight size={23} color="#b2437f"/>
    </Link>)
   }
  </section>
 </div></main>;
}