'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,ChevronRight,Clock3,Download,MessageCircle,Package,Phone,ReceiptText,Search,ShieldCheck,ShoppingBag,Smartphone,Wallet} from 'lucide-react';
import {getSupabase,isDemo} from '@/lib/supabase';
import {readDemo} from '@/lib/demo';
import type {StoreData,StoreTable,Invoice,Customer} from '@/lib/types';
import {idr,invoiceBalance,invoiceItems,invoiceStatus,invoiceTotal,lineSales,normalizePhone,paidTotal,shortDate} from '@/lib/finance';

type Stage='phone'|'otp'|'list'|'detail';
function Status({status}:{status:string}){return <span className={'pill '+(status==='Lunas'?'paid':status==='DP'?'partial':'unpaid')}>● {status}</span>;}
export default function CustomerPage(){
 const [stage,setStage]=useState<Stage>('phone');
 const [phone,setPhone]=useState('');
 const [normalized,setNormalized]=useState('');
 const [otp,setOtp]=useState('');
 const [customer,setCustomer]=useState<Customer|null>(null);
 const [data,setData]=useState<StoreData|null>(null);
 const [selected,setSelected]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const current=data?.invoices.find(i=>i.id===selected)||null;
 const settings=data?.settings[0];
 function clear(){setError('');setNotice('');}
 async function fetchVerifiedCustomer(verifiedPhone:string){
  if(isDemo){
   const snapshot=readDemo();
   const match=snapshot.customers.find(c=>c.phone_e164===verifiedPhone);
   if(!match)throw new Error('Nomor belum terdaftar. Hubungi admin Titiplen untuk mengecek data pesanan kamu.');
   setCustomer(match);setData(snapshot);setStage('list');return;
  }
  const sb=getSupabase();
  const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError||!user?.phone||normalizePhone(user.phone)!==verifiedPhone)throw new Error('Verifikasi nomor diperlukan.');
  const {data:profile,error:profileError}=await sb.from('customers').select('*').eq('phone_e164',verifiedPhone).maybeSingle();
  if(profileError)throw profileError;
  if(!profile)throw new Error('Nomor sudah terverifikasi tetapi belum terdaftar sebagai customer. Hubungi admin.');
  const tables:StoreTable[]=['orders','order_items','events','invoices','invoice_items','payments','expenses','settings'];
  const all=await Promise.all(tables.map(async(t)=>{
   // RLS membatasi order, invoice dan payment customer ke nomor HP dari JWT yang SUDAH terverifikasi.
   const r=await sb.from(t).select('*');
   if(r.error)throw r.error;
   return [t,r.data||[]] as const;
  }));
  const raw=Object.fromEntries(all) as unknown as Pick<StoreData,'orders'|'order_items'|'events'|'invoices'|'invoice_items'|'payments'|'expenses'|'settings'>;
  setCustomer(profile as Customer);setData({...raw,customers:[profile as Customer]});setStage('list');
 }
 useEffect(()=>{if(isDemo)return;try{getSupabase().auth.getUser().then(({data:{user}})=>{if(user?.phone){const n=normalizePhone(user.phone);if(n){setPhone(n);setNormalized(n);void fetchVerifiedCustomer(n).catch(()=>{setStage('phone');});}}});}catch{}},[]);
 async function submitPhone(e:FormEvent){
  e.preventDefault();clear();
  const n=normalizePhone(phone);
  if(!n){setError('Masukkan nomor HP Indonesia yang valid (08...).');return;}
  setNormalized(n);setBusy(true);
  try{
   if(isDemo){await fetchVerifiedCustomer(n);return;}
   const {error:err}=await getSupabase().auth.signInWithOtp({phone:n,options:{shouldCreateUser:true}});
   if(err)throw err;
   setStage('otp');setNotice('Kode OTP SMS telah diminta. Periksa pesan SMS di nomor ini.');
  }catch(e){setError(e instanceof Error?e.message:'Gagal memeriksa nomor.');}finally{setBusy(false);}
 }
 async function verifyOtp(e:FormEvent){
  e.preventDefault();setBusy(true);clear();
  try{
   const {error:err}=await getSupabase().auth.verifyOtp({phone:normalized,token:otp,type:'sms'});
   if(err)throw err;
   await fetchVerifiedCustomer(normalized);
  }catch(e){setError(e instanceof Error?e.message:'OTP tidak valid.');}finally{setBusy(false);}
 }
 async function exit(){
  if(!isDemo)await getSupabase().auth.signOut();
  setPhone('');setOtp('');setNormalized('');setCustomer(null);setData(null);setSelected('');setStage('phone');clear();
 }
 const waLink=(invoice:Invoice)=>{const wa=settings?.whatsapp_number?.replace(/\D/g,'')||'';
  const msg='Halo admin '+(settings?.business_name||'Titiplen.id')+', saya '+(customer?.name||'customer')+' ingin konfirmasi pembayaran invoice '+invoice.invoice_number+' sejumlah '+idr(invoiceBalance(data!,invoice.id))+'. Mohon bantu cek mutasi pembayaran saya. Terima kasih!';
  return !isDemo&&wa?'https://wa.me/'+wa+'?text='+encodeURIComponent(msg):'';
 };
 return <div className="customer-page"><header className="customer-nav"><div><Link href="/" className="brand-brand"><span className="brand-symbol"><ShoppingBag size={20}/></span>titiplen<span className="brand-dot">.id</span></Link><Link href="/">Beranda <ArrowRight size={13}/></Link></div></header>
 <main className="customer-container">
 {stage==='phone'&&<><div className="customer-head"><span className="eyebrow">YOUR HAPPY SHOPPING SPACE ✨</span><h1>Cek pesananmu, yuk!</h1><p>Masukkan nomor WhatsApp yang kamu gunakan saat titip barang. Semua invoice dan detail titipanmu ada di satu tempat.</p></div><div className="customer-search"><h2>Temukan pesananmu</h2><p>{isDemo?'Mode demo: gunakan 081234567890 untuk mencoba tampilan customer.':'Kamu akan menerima kode verifikasi melalui SMS untuk melindungi privasi pesananmu.'}</p><form onSubmit={submitPhone}><label className="form-label">Nomor WhatsApp / HP</label><div style={{position:'relative'}}><Smartphone size={17} style={{position:'absolute',top:14,left:13,color:'#879aa3'}}/><input style={{paddingLeft:42}} className="form-input" placeholder="Contoh: 081234567890" value={phone} onChange={e=>setPhone(e.target.value)} required inputMode="tel" autoComplete="tel"/></div>{error&&<div className="inline-error" style={{marginTop:12}}>{error}</div>}<button disabled={busy} className="button button-dark"><Search size={17}/>{busy?'Mencari…':'Cek invoice saya'} <ArrowRight size={17}/></button></form><div className="demo-hint"><ShieldCheck size={15} style={{verticalAlign:'middle'}}/> {isDemo?'Demo tidak memakai OTP atau data asli.':'Nomor harus terverifikasi sebelum rincian pesanan tampil.'}</div></div></>}
 {stage==='otp'&&<><div className="customer-head"><span className="eyebrow">VERIFIKASI NOMOR</span><h1>Masukkan kode OTP</h1><p>Kode SMS dikirim ke {normalized}. Jangan bagikan kode ke siapa pun.</p></div><div className="customer-search"><form onSubmit={verifyOtp}><label className="form-label">Kode OTP SMS</label><input className="form-input" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} inputMode="numeric" placeholder="6 digit kode" minLength={6} required/>{error&&<div className="inline-error" style={{marginTop:12}}>{error}</div>}{notice&&<div className="inline-success" style={{marginTop:12}}>{notice}</div>}<button className="button button-dark" disabled={busy}>{busy?'Memeriksa…':'Verifikasi & lihat invoice'} <ArrowRight size={17}/></button></form><button className="back-link" onClick={()=>{setStage('phone');clear();}}>← Ganti nomor HP</button></div></>}
 {(stage==='list'||stage==='detail')&&data&&customer&&<><div className="customer-head"><span className="eyebrow">HALO, {customer.name.toUpperCase()} ♡</span><h1>{stage==='list'?'Titipan kamu ada di sini.':'Detail invoice kamu'}</h1><p>{stage==='list'?'Pilih invoice di bawah untuk lihat rincian barang dan info pembayaran.':'Semua pesanan dan rincian pembayaran dalam satu halaman.'}</p><button onClick={exit} className="back-link">Keluar / Ganti nomor HP <ArrowRight size={14}/></button></div>
 {stage==='list'&&<div className="customer-list">{data.invoices.length===0?<div className="customer-search"><p>Belum ada invoice atas nama kamu. Hubungi admin jika pesananmu sudah dibuat tetapi belum muncul di sini.</p></div>:data.invoices.slice().reverse().map(i=><button key={i.id} className="customer-invoice" onClick={()=>{setSelected(i.id);setStage('detail');window.scrollTo({top:0,behavior:'smooth'});}}><div><Status status={invoiceStatus(data,i.id)}/><h3>{i.invoice_number}</h3><p>{shortDate(i.created_at)} · {invoiceItems(data,i).length} jenis barang</p></div><div style={{display:'flex',alignItems:'center',gap:16}}><strong>{idr(invoiceTotal(data,i.id))}</strong><ChevronRight size={19} color="#7fa592"/></div></button>)}</div>}
 {stage==='detail'&&current&&<><button className="back-link" onClick={()=>setStage('list')}><ArrowLeft size={16}/> Kembali ke daftar invoice</button><div className="invoice-detail"><div className="invoice-detail-head"><div><span className="eyebrow">TITIPLEN · INVOICE</span><h2>{current.invoice_number}</h2><p>Dibuat {shortDate(current.created_at)} · Jatuh tempo {shortDate(current.due_date)}</p></div><Status status={invoiceStatus(data,current.id)}/></div><div className="section-mini" style={{marginTop:30}}>Detail barang titipan ({invoiceItems(data,current).length})</div>{invoiceItems(data,current).map((item,index)=>{const order=data.orders.find(o=>o.id===item.order_id);const event=data.events.find(e=>e.id===order?.event_id);return <div className="lineitem" key={item.id}><div className={'product-avatar '+(index%2?'blush':'lilac')}><Package size={21}/></div><div className="lineitem-info"><strong>{item.brand} {item.product_name}</strong><small>{item.variant||'—'} · {item.quantity} pcs · {event?.name||'Tanpa event'}</small></div><strong>{idr(lineSales(item))}</strong></div>})}<div className="invoice-totals"><div><span>Total tagihan</span><b>{idr(invoiceTotal(data,current.id))}</b></div><div><span>Sudah dibayar</span><b>{idr(paidTotal(data,current.id))}</b></div><div className="grand-total"><strong>Sisa tagihan</strong><b>{idr(invoiceBalance(data,current.id))}</b></div></div>{invoiceBalance(data,current.id)>0?<div className="qris-panel"><h3><Wallet size={18} style={{verticalAlign:'middle',marginRight:8}}/>Bayar titipanmu</h3><p>Gunakan QRIS resmi Titiplen lalu konfirmasi ke admin WhatsApp. Nominal pembayaran mengikuti total tagihan atau sisa DP.</p>{settings?.qris_image_url?<><img src={settings.qris_image_url} alt="Gambar QRIS resmi Titiplen.id"/><a className="back-link" href={settings.qris_image_url} target="_blank" rel="noopener noreferrer"><Download size={15}/> Buka / simpan QRIS</a></>:<div className="notice" style={{marginBottom:15}}>QRIS belum diatur oleh admin. Minta gambar QRIS resmi melalui WhatsApp.</div>}<div style={{fontSize:13,fontWeight:800,marginBottom:15}}>Nominal yang perlu dibayar: {idr(invoiceBalance(data,current.id))}</div>{waLink(current)?<a className="button button-dark" href={waLink(current)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/> Konfirmasi via WhatsApp <ArrowRight size={16}/></a>:<div className="notice">Nomor WhatsApp admin belum diatur. Hubungi Titiplen melalui kanal resmi.</div>}</div>:<div className="qris-panel"><CheckCircle2 size={34} color="#2b8767"/><h3 style={{marginTop:8}}>Pembayaran lunas ♡</h3><p>Terima kasih! Seluruh pembayaran invoice ini telah diverifikasi admin.</p></div>}<div className="receipt-note"><ShieldCheck size={16} style={{verticalAlign:'middle',marginRight:8}}/>Status dibayar hanya diperbarui setelah admin memverifikasi mutasi QRIS. Pesan WhatsApp bukan bukti pembayaran otomatis.</div></div></>}</>}
 </main><footer className="landing-footer" style={{maxWidth:1100,margin:'0 auto'}}><strong>titiplen.id</strong><span>Happy shopping, happy titipan. ♡</span></footer></div>;
}