'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRight,BarChart3,CalendarDays,Check,ChevronRight,CircleAlert,ClipboardList,Download,FileText,LayoutDashboard,LogOut,Package,Plus,Receipt,RefreshCw,Save,Search,Settings2,ShoppingBag,Trash2,Users,Wallet} from 'lucide-react';
import type {StoreData,StoreTable} from '@/lib/types';
import {getBusinessFinance,getEventFinance,idr,invoiceBalance,invoiceItems,invoiceStatus,invoiceTotal,lineProfit,lineSales,nextInvoiceNumber,normalizePhone,paidTotal,shortDate} from '@/lib/finance';
import {getSupabase,isDemo} from '@/lib/supabase';
import {insertDemo,readDemo,resetDemo,updateSettingsDemo} from '@/lib/demo';
import {Money} from '@/components/money-input';

type View='dashboard'|'orders'|'items'|'customers'|'events'|'invoices'|'expenses'|'settings';
type ItemDraft={brand:string;product_name:string;variant:string;quantity:number;cost_unit:number;fee_unit:number;extra_fee_unit:number;shipping_charge:number;shipping_cost:number;discount:number};
const freshItem=():ItemDraft=>({brand:'',product_name:'',variant:'',quantity:1,cost_unit:0,fee_unit:0,extra_fee_unit:0,shipping_charge:0,shipping_cost:0,discount:0});
const tabs:{id:View;label:string;icon:typeof LayoutDashboard}[]=[
{id:'dashboard',label:'Dashboard',icon:LayoutDashboard},
{id:'orders',label:'Input Pesanan',icon:ClipboardList},
{id:'items',label:'Rekap Barang',icon:Package},
{id:'customers',label:'Customer',icon:Users},
{id:'events',label:'Event Jastip',icon:CalendarDays},
{id:'invoices',label:'Invoice & Bayar',icon:Receipt},
{id:'expenses',label:'Pengeluaran',icon:Wallet},
{id:'settings',label:'Pengaturan',icon:Settings2}
];
const today=()=>new Date().toISOString().slice(0,10);

function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="form-label">{label}</span>{children}</label>}
function Empty({text}:{text:string}){return <div className="empty-state"><Package size={27}/><strong>Belum ada data</strong><p>{text}</p></div>}
function Stat({label,value,sub,icon:Icon}:{label:string;value:string;sub:string;icon:typeof Wallet}){return <div className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={19}/></span><span className="chip">● Live data</span></div><div className="stat-label">{label}</div><div className="stat-num">{value}</div><div className="stat-foot">{sub}</div></div>}
function toCsv(rows:(string|number)[][]):string{return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');}
function downloadCsv(name:string,rows:(string|number)[][]){
 const url=URL.createObjectURL(new Blob([toCsv(rows)],{type:'text/csv;charset=utf-8;'}));
 const el=document.createElement('a');el.href=url;el.download=name;el.click();URL.revokeObjectURL(url);
}
export default function AdminPage(){
 const [view,setView]=useState<View>('dashboard');
 const [auth,setAuth]=useState<'checking'|'login'|'ready'>('checking');
 const [data,setData]=useState<StoreData|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [customerName,setCustomerName]=useState('');
 const [customerPhone,setCustomerPhone]=useState('');
 const [eventName,setEventName]=useState('');
 const [eventDate,setEventDate]=useState(today());
 const [eventStatus,setEventStatus]=useState('Aktif');
 const [orderCustomer,setOrderCustomer]=useState('');
 const [orderEvent,setOrderEvent]=useState('');
 const [orderNotes,setOrderNotes]=useState('');
 const [orderLines,setOrderLines]=useState<ItemDraft[]>([freshItem()]);
 const [invoiceCustomer,setInvoiceCustomer]=useState('');
 const [invoiceSelected,setInvoiceSelected]=useState<string[]>([]);
 const [invoiceDue,setInvoiceDue]=useState('');
 const [invoiceNotes,setInvoiceNotes]=useState('');
 const [detailInvoice,setDetailInvoice]=useState('');
 const [paymentAmount,setPaymentAmount]=useState(0);
 const [paymentRef,setPaymentRef]=useState('');
 const [expenseEvent,setExpenseEvent]=useState('');
 const [expenseCategory,setExpenseCategory]=useState('Transportasi');
 const [expenseDesc,setExpenseDesc]=useState('');
 const [expenseAmount,setExpenseAmount]=useState(0);
 const [expenseDate,setExpenseDate]=useState(today());
 const [qrisUrl,setQrisUrl]=useState('');
 const [waNumber,setWaNumber]=useState('');
 const [businessName,setBusinessName]=useState('Titiplen.id');
 const [eventFilter,setEventFilter]=useState('all');
 const [keyword,setKeyword]=useState('');
 const report=useMemo(()=>data?getBusinessFinance(data):null,[data]);
 const currentInvoice=data?.invoices.find(i=>i.id===detailInvoice)||null;
 const invoiceOutstanding=currentInvoice&&data?invoiceBalance(data,currentInvoice.id):0;

 async function reload(){
   if(isDemo){setData(readDemo());return;}
   const sb=getSupabase();
   const tables:StoreTable[]=['customers','events','orders','order_items','invoices','invoice_items','payments','expenses','settings'];
   const result=await Promise.all(tables.map(async table=>{
     const rows:Record<string,unknown>[]=[];let from=0;
     while(true){
       const r=await sb.from(table).select('*').range(from,from+999);
       if(r.error)throw new Error(table+': '+r.error.message);
       const batch=(r.data||[]) as Record<string,unknown>[];
       rows.push(...batch);if(batch.length<1000)break;from+=1000;
     }
     return [table,rows] as const;
   }));
   setData(Object.fromEntries(result) as unknown as StoreData);
 }
 async function authorize(){
   if(isDemo){setAuth('ready');await reload();return;}
   const sb=getSupabase();
   const {data:{user},error:err}=await sb.auth.getUser();
   if(err||!user){setAuth('login');return;}
   const role=await sb.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
   if(role.error||!role.data){await sb.auth.signOut();setAuth('login');setError('Akun ini belum terdaftar sebagai admin Titiplen.');return;}
   setAuth('ready');await reload();
 }
 useEffect(()=>{authorize().catch(e=>{setError(e instanceof Error?e.message:'Gagal menghubungkan database');setAuth('login');});},[]);
 useEffect(()=>{if(data?.settings[0]){const s=data.settings[0];setQrisUrl(s.qris_image_url);setWaNumber(s.whatsapp_number);setBusinessName(s.business_name);}},[data?.settings]);
 async function login(e:FormEvent){e.preventDefault();setBusy(true);setError('');
  try{
   const {error:err}=await getSupabase().auth.signInWithPassword({email,password});
   if(err)throw err;await authorize();
  }catch(e){setError(e instanceof Error?e.message:'Login gagal');}finally{setBusy(false);}
 }
 async function logout(){if(isDemo){setAuth('ready');setView('dashboard');return;}await getSupabase().auth.signOut();setAuth('login');setData(null);}
 async function perform(action:()=>Promise<void>,success:string){
   setBusy(true);setError('');setNotice('');
   try{await action();await reload();setNotice(success);window.scrollTo({top:0,behavior:'smooth'});}
   catch(e){setError(e instanceof Error?e.message:'Terjadi kesalahan');}
   finally{setBusy(false);}
 }
 async function insert(table:StoreTable,payload:Record<string,unknown>){
   if(isDemo){insertDemo(table,payload);return;}
   const {error:err}=await getSupabase().from(table).insert(payload);
   if(err)throw err;
 }
 const customerNameById=(id:string)=>data?.customers.find(c=>c.id===id)?.name||'—';
 const eventNameById=(id:string|null)=>data?.events.find(e=>e.id===id)?.name||'Tanpa event';
 const orderById=(id:string)=>data?.orders.find(o=>o.id===id);
 const invoiceByItem=new Set(data?.invoice_items.map(i=>i.order_item_id)||[]);
 const freeItems=data?.order_items.filter(i=>!invoiceByItem.has(i.id)&&orderById(i.order_id)?.customer_id===invoiceCustomer)||[];
 const itemsWithCustomer=(data?.order_items||[]).filter(i=>{
   const order=orderById(i.order_id);
   return (eventFilter==='all'||(order?.event_id||'none')===eventFilter)&&
   (keyword===''||(i.product_name+' '+i.brand+' '+customerNameById(order?.customer_id||'')).toLowerCase().includes(keyword.toLowerCase()));
 });
 function updateLine(index:number,key:keyof ItemDraft,value:string|number){setOrderLines(lines=>lines.map((line,i)=>i===index?{...line,[key]:value}:line));}
 function updateSelection(id:string){setInvoiceSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);}
 const orderTotal=orderLines.reduce((s,i)=>s+lineSales({...i,id:'',order_id:''}),0);

 if(auth==='checking')return <div className="auth-box"><div className="spinner"/><p style={{textAlign:'center'}}>Memeriksa akun admin…</p></div>;
 if(auth==='login')return <main className="auth-box"><Link href="/" className="brand-brand"><span className="brand-symbol"><ShoppingBag/></span>Titiplen.id</Link><h1>Masuk sebagai admin</h1><p>Akses khusus pengelola Titiplen. Login dengan email dan kata sandi yang sudah terdaftar sebagai admin.</p>{error&&<div className="inline-error">{error}</div>}<form onSubmit={login}><Field label="Email"><input className="form-input" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></Field><Field label="Password"><input className="form-input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></Field><button className="button button-dark" disabled={busy}>{busy?'Memproses…':'Masuk dashboard'} <ArrowRight size={17}/></button></form><Link href="/" className="back-link" style={{marginTop:16}}>← Kembali ke website</Link></main>;
 if(!data||!report)return <main className="auth-box"><div className="spinner"/><p>Memuat data Titiplen…</p></main>;
 const submitCustomer=(e:FormEvent)=>{e.preventDefault();const phone=normalizePhone(customerPhone);if(!phone){setError('Nomor HP tidak valid. Gunakan nomor Indonesia 08…');return;}if(data.customers.some(c=>c.phone_e164===phone)){setError('Nomor WhatsApp sudah terdaftar.');return;}void perform(async()=>{await insert('customers',{name:customerName.trim(),phone_e164:phone});setCustomerName('');setCustomerPhone('');},'Customer berhasil ditambahkan.');};
 const submitEvent=(e:FormEvent)=>{e.preventDefault();void perform(async()=>{await insert('events',{name:eventName.trim(),event_date:eventDate||null,status:eventStatus});setEventName('');},'Event berhasil dibuat.');};
 const submitOrder=(e:FormEvent)=>{e.preventDefault();if(!orderCustomer||!orderLines.length||orderLines.some(i=>!i.product_name.trim()||i.quantity<1||lineSales({...i,id:'',order_id:''})<0)){setError('Lengkapi customer, nama barang, jumlah, serta nilai yang valid.');return;}
  void perform(async()=>{
   if(isDemo){const order=insertDemo('orders',{customer_id:orderCustomer,event_id:orderEvent||null,notes:orderNotes});for(const line of orderLines)insertDemo('order_items',{...line,order_id:order.id});}
   else {const result=await getSupabase().rpc('create_titiplen_order',{p_customer:orderCustomer,p_event:orderEvent||null,p_notes:orderNotes,p_items:orderLines});if(result.error)throw result.error;}
   setOrderLines([freshItem()]);setOrderNotes('');
  },'Pesanan berhasil dicatat. Barang siap dimasukkan ke invoice.');
 };
 const submitInvoice=(e:FormEvent)=>{e.preventDefault();if(!invoiceCustomer||!invoiceSelected.length){setError('Pilih customer dan minimal satu barang.');return;}
  void perform(async()=>{
   if(isDemo){const invoice=insertDemo('invoices',{customer_id:invoiceCustomer,invoice_number:nextInvoiceNumber(data),due_date:invoiceDue||null,notes:invoiceNotes});for(const id of invoiceSelected)insertDemo('invoice_items',{invoice_id:invoice.id,order_item_id:id});}
   else{const r=await getSupabase().rpc('create_titiplen_invoice',{p_customer:invoiceCustomer,p_item_ids:invoiceSelected,p_due_date:invoiceDue||null,p_notes:invoiceNotes});if(r.error)throw r.error;}
   setInvoiceSelected([]);setInvoiceNotes('');setInvoiceDue('');
  },'Invoice berhasil dibuat. Customer dapat melihatnya setelah verifikasi nomor HP.');
 };
 const submitPayment=(e:FormEvent)=>{e.preventDefault();if(!currentInvoice||paymentAmount<=0||paymentAmount>invoiceOutstanding){setError('Nominal harus lebih dari Rp0 dan tidak melebihi sisa tagihan.');return;}
  void perform(async()=>{if(isDemo)insertDemo('payments',{invoice_id:currentInvoice.id,amount:paymentAmount,paid_at:new Date().toISOString(),reference:paymentRef.trim(),method:'QRIS'});
   else{const r=await getSupabase().rpc('record_titiplen_payment',{p_invoice:currentInvoice.id,p_amount:paymentAmount,p_reference:paymentRef.trim()});if(r.error)throw r.error;}
   setPaymentAmount(0);setPaymentRef('');
  },'Pembayaran terverifikasi dan sisa tagihan diperbarui.');
 };
 const submitExpense=(e:FormEvent)=>{e.preventDefault();if(expenseAmount<=0){setError('Nominal pengeluaran harus lebih dari nol.');return;}
  void perform(async()=>{await insert('expenses',{event_id:expenseEvent||null,category:expenseCategory,description:expenseDesc.trim(),amount:expenseAmount,spent_at:expenseDate});setExpenseAmount(0);setExpenseDesc('');},'Pengeluaran berhasil dicatat.');
 };
 const submitSettings=(e:FormEvent)=>{e.preventDefault();if(waNumber&&!/^[0-9]{10,16}$/.test(waNumber)){setError('Nomor WhatsApp admin harus format internasional angka saja, misalnya 62812...');return;}
  if(qrisUrl&&!/^https:\/\/[^\s]+$/i.test(qrisUrl)){setError('URL gambar QRIS harus diawali https://.');return;}
  void perform(async()=>{
    if(isDemo)updateSettingsDemo({whatsapp_number:waNumber,qris_image_url:qrisUrl,business_name:businessName});
    else {const r=await getSupabase().from('settings').update({whatsapp_number:waNumber,qris_image_url:qrisUrl,business_name:businessName}).eq('id',1);if(r.error)throw r.error;}
  },'Pengaturan pembayaran tersimpan.');
 };

 return <div className="app-shell">
  <aside className="sidebar"><Link href="/" className="brand-brand"><span className="brand-symbol"><ShoppingBag size={21}/></span>titiplen<span className="brand-dot">.id</span></Link><div className="side-label">WORKSPACE</div><nav className="side-links">{tabs.map(t=><button key={t.id} className={'side-link'+(view===t.id?' active':'')} onClick={()=>{setView(t.id);setError('');setNotice('');}}><t.icon size={18}/>{t.label}</button>)}</nav><div className="side-footer"><p>{isDemo?'🟢 Demo interaktif — data tersimpan di browser.':'🔐 Terhubung ke database Titiplen.'}</p><button className="side-link" onClick={logout}><LogOut size={16}/>{isDemo?'Kembali ke dashboard':'Keluar akun'}</button><Link className="side-link" href="/cek-invoice"><ArrowRight size={16}/>Portal customer</Link></div></aside>
  <main className="main-panel"><div className="topline"><div className="title-block"><small>WORKSPACE / TITIPLEN MANAGEMENT</small><h1>{({dashboard:'Ringkasan bisnis',orders:'Input pesanan',items:'Rekap barang',customers:'Data customer',events:'Event jastip',invoices:'Invoice & pembayaran',expenses:'Pengeluaran',settings:'Pengaturan toko'} as Record<View,string>)[view]}</h1></div><div className="top-actions">{isDemo?<span className="badge-demo">MODE DEMO</span>:<span className="badge-demo">DATABASE AKTIF</span>}<span className="avatar-admin">TL</span></div></div>
  {error&&<div className="inline-error"><CircleAlert size={15} style={{verticalAlign:'middle',marginRight:7}}/>{error}</div>}
  {notice&&<div className="inline-success"><Check size={15} style={{verticalAlign:'middle',marginRight:7}}/>{notice}</div>}
  {view==='dashboard'&&<>
    <div className="stat-grid"><Stat label="Total penjualan" value={idr(report.sales)} sub="Semua barang yang tercatat" icon={BarChart3}/><Stat label="Estimasi laba bersih" value={idr(report.profit)} sub="Setelah biaya barang & operasional" icon={Wallet}/><Stat label="Piutang invoice" value={idr(report.outstanding)} sub="Tagihan belum terbayar" icon={Receipt}/><Stat label="Total customer" value={String(data.customers.length)} sub={data.invoices.length+' invoice diterbitkan'} icon={Users}/></div>
    <div className="two-col"><section className="panel-card"><div className="panel-title"><div><h2>Profitabilitas event</h2><div className="panel-sub">Sumber perhitungan: pesanan, modal, dan biaya event.</div></div><BarChart3 size={19} color="#56a183"/></div>{data.events.length===0?<Empty text="Buat event untuk memantau laba per kegiatan."/>:data.events.map(ev=>{const f=getEventFinance(data,ev.id);return <div key={ev.id}><div className="metric-row"><span>{ev.name}</span><strong style={{color:f.profit<0?'#bd5b55':'#2f8b6e'}}>{idr(f.profit)} <small className="muted">({f.margin.toFixed(1)}%)</small></strong></div><div className="bar-track"><div className={'bar-value'+(f.profit<0?' loss':'')} style={{width:Math.min(100,Math.max(2,Math.abs(f.profit)/(Math.max(...data.events.map(e=>Math.abs(getEventFinance(data,e.id).profit)),1))*100))+'%'}}/></div></div>})}<div className="section-foot"><span className="small muted">Tanpa event: {idr(getEventFinance(data,null).profit)}</span><button className="button button-ghost button-small" onClick={()=>setView('events')}>Lihat semua <ChevronRight size={16}/></button></div></section>
    <section className="panel-card"><div className="panel-title"><div><h2>Ringkasan keuangan</h2><div className="panel-sub">Penjualan ≠ kas masuk</div></div><Wallet size={19} color="#56a183"/></div>{[['Total penjualan',report.sales],['Total modal + ongkir aktual',report.cost],['Biaya event & overhead',report.expenses],['Laba keseluruhan',report.profit],['Invoice diterbitkan',report.billed],['Pembayaran terverifikasi',report.collected],['Sisa tagihan customer',report.outstanding]].map(([name,val])=><div className="metric-row" key={name as string}><span>{name}</span><strong>{idr(val as number)}</strong></div>)}<div className="notice" style={{marginTop:18}}>Laporan laba menggunakan seluruh pesanan yang tercatat, termasuk barang yang belum ditagihkan. Gunakan angka piutang dan kas terverifikasi untuk memantau likuiditas.</div></section></div>
    <section className="panel-card"><div className="panel-title"><h2>Invoice terbaru</h2><button className="button button-outline button-small" onClick={()=>setView('invoices')}>Lihat invoice <ArrowRight size={14}/></button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>NO. INVOICE</th><th>CUSTOMER</th><th>TOTAL</th><th>SISA TAGIHAN</th><th>STATUS</th></tr></thead><tbody>{data.invoices.slice().reverse().slice(0,6).map(i=><tr key={i.id}><td><strong>{i.invoice_number}</strong></td><td>{customerNameById(i.customer_id)}</td><td>{idr(invoiceTotal(data,i.id))}</td><td>{idr(invoiceBalance(data,i.id))}</td><td><span className={'pill '+(invoiceStatus(data,i.id)==='Lunas'?'paid':invoiceStatus(data,i.id)==='DP'?'partial':'unpaid')}>{invoiceStatus(data,i.id)}</span></td></tr>)}</tbody></table></div></section>
  </>}
  {view==='customers'&&<><section className="panel-card"><div className="panel-title"><h2>Tambah customer</h2><span className="chip">Nomor HP unik</span></div><form onSubmit={submitCustomer} className="form-grid"><Field label="Nama lengkap"><input className="form-input" required value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Nama customer"/></Field><Field label="WhatsApp (08...)"><input className="form-input" required inputMode="tel" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="081234567890"/></Field><div className="field-wide form-actions"><button disabled={busy} className="button button-dark"><Plus size={16}/> Tambah customer</button></div></form></section><section className="panel-card"><div className="panel-title"><h2>Daftar customer ({data.customers.length})</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>NAMA</th><th>NO. WHATSAPP</th><th>JUMLAH ORDER</th><th>JUMLAH INVOICE</th></tr></thead><tbody>{data.customers.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone_e164}</td><td>{data.orders.filter(o=>o.customer_id===c.id).length}</td><td>{data.invoices.filter(i=>i.customer_id===c.id).length}</td></tr>)}</tbody></table></div></section></>}
  {view==='events'&&<><section className="panel-card"><div className="panel-title"><h2>Event jastip baru</h2></div><form onSubmit={submitEvent} className="form-grid three"><Field label="Nama event"><input className="form-input" required value={eventName} onChange={e=>setEventName(e.target.value)} placeholder="Nama event / bazar"/></Field><Field label="Tanggal"><input className="form-input" type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)}/></Field><Field label="Status"><select className="form-select" value={eventStatus} onChange={e=>setEventStatus(e.target.value)}><option>Aktif</option><option>Selesai</option></select></Field><div className="field-wide form-actions"><button disabled={busy} className="button button-dark"><Plus size={16}/> Buat event</button></div></form></section><section className="panel-card"><div className="panel-title"><h2>Rekap profitabilitas per event</h2><button className="button button-outline button-small" onClick={()=>downloadCsv('titiplen-profit-event.csv',[['Event','Tanggal','Penjualan','Modal+Ongkir Aktual','Biaya Event','Laba','Margin %'],...data.events.map(e=>{const f=getEventFinance(data,e.id);return[e.name,e.event_date||'',f.sales,f.cost,f.expenses,f.profit,f.margin.toFixed(2)];})])}><Download size={16}/> Export CSV</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>EVENT</th><th>TANGGAL</th><th>OMZET</th><th>MODAL</th><th>BIAYA EVENT</th><th>LABA</th><th>MARGIN</th></tr></thead><tbody>{data.events.map(e=>{const f=getEventFinance(data,e.id);return <tr key={e.id}><td><strong>{e.name}</strong><br/><span className="caption">{e.status}</span></td><td>{shortDate(e.event_date)}</td><td>{idr(f.sales)}</td><td>{idr(f.cost)}</td><td>{idr(f.expenses)}</td><td><strong style={{color:f.profit<0?'#bd5b55':'#25815f'}}>{idr(f.profit)}</strong></td><td>{f.margin.toFixed(1)}%</td></tr>})}</tbody></table></div></section></>}
  {view==='orders'&&<section className="panel-card"><div className="panel-title"><div><h2>Input pesanan baru</h2><div className="panel-sub">Satu pesanan bisa berisi beberapa barang.</div></div><span className="chip">Semua harga dalam Rupiah</span></div><form onSubmit={submitOrder}>
   <div className="form-grid three"><Field label="Customer"><select className="form-select" required value={orderCustomer} onChange={e=>setOrderCustomer(e.target.value)}><option value="">Pilih customer</option>{data.customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone_e164}</option>)}</select></Field><Field label="Event jastip"><select className="form-select" value={orderEvent} onChange={e=>setOrderEvent(e.target.value)}><option value="">Tanpa event</option>{data.events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><Field label="Catatan pesanan"><input className="form-input" value={orderNotes} onChange={e=>setOrderNotes(e.target.value)} placeholder="Opsional"/></Field></div>
   <div className="section-mini">Rincian barang</div>
   {orderLines.map((line,index)=><div className="item-card" key={index}><div className="item-head"><strong>Barang #{index+1}</strong>{orderLines.length>1&&<button type="button" className="square-button" onClick={()=>setOrderLines(rows=>rows.filter((_,i)=>i!==index))} aria-label="Hapus barang"><Trash2 size={15}/></button>}</div><div className="form-grid four">
     <Field label="Brand"><input className="form-input" value={line.brand} onChange={e=>updateLine(index,'brand',e.target.value)} placeholder="Contoh: Skintific"/></Field>
     <Field label="Nama barang"><input className="form-input" required value={line.product_name} onChange={e=>updateLine(index,'product_name',e.target.value)} placeholder="Nama produk"/></Field>
     <Field label="Shade / ukuran"><input className="form-input" value={line.variant} onChange={e=>updateLine(index,'variant',e.target.value)} placeholder="Shade / Size"/></Field>
     <Field label="Jumlah"><input className="form-input" type="number" min="1" step="1" required value={line.quantity} onChange={e=>updateLine(index,'quantity',Math.max(1,Number(e.target.value)||1))}/></Field>
     <Field label="Modal per unit"><Money value={line.cost_unit} onChange={v=>updateLine(index,'cost_unit',v)}/></Field>
     <Field label="Fee jastip per unit"><Money value={line.fee_unit} onChange={v=>updateLine(index,'fee_unit',v)}/></Field>
     <Field label="Add fee per unit"><Money value={line.extra_fee_unit} onChange={v=>updateLine(index,'extra_fee_unit',v)}/></Field>
     <Field label="Ongkir ditagihkan"><Money value={line.shipping_charge} onChange={v=>updateLine(index,'shipping_charge',v)}/></Field>
     <Field label="Ongkir aktual"><Money value={line.shipping_cost} onChange={v=>updateLine(index,'shipping_cost',v)}/></Field>
     <Field label="Diskon total barang"><Money value={line.discount} onChange={v=>updateLine(index,'discount',v)}/></Field>
   </div><div className="section-foot"><span className="small muted">Laba sebelum biaya event: {idr(lineProfit({...line,id:'',order_id:''}))}</span><strong>{idr(lineSales({...line,id:'',order_id:''}))}</strong></div></div>)}
   <div className="form-actions" style={{justifyContent:'space-between'}}><button type="button" className="button button-outline" onClick={()=>setOrderLines(lines=>[...lines,freshItem()])}><Plus size={16}/> Tambah barang</button><div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><strong>Total: {idr(orderTotal)}</strong><button disabled={busy} className="button button-dark"><Save size={16}/> Simpan pesanan</button></div></div>
  </form></section>}
  {view==='items'&&<section className="panel-card"><div className="panel-title"><div><h2>Rekap seluruh barang</h2><div className="panel-sub">{data.order_items.length} baris barang tercatat</div></div><button className="button button-outline button-small" onClick={()=>downloadCsv('titiplen-barang.csv',[['Customer','Event','Brand','Barang','Varian','Qty','Modal/unit','Fee/unit','AddFee/unit','Ongkir tagih','Ongkir aktual','Diskon','Total','Laba','Status invoice'],...itemsWithCustomer.map(i=>{const o=orderById(i.order_id);return[customerNameById(o?.customer_id||''),eventNameById(o?.event_id||null),i.brand,i.product_name,i.variant,i.quantity,i.cost_unit,i.fee_unit,i.extra_fee_unit,i.shipping_charge,i.shipping_cost,i.discount,lineSales(i),lineProfit(i),invoiceByItem.has(i.id)?'Sudah diinvoice':'Belum diinvoice'];})])}><Download size={15}/> Export CSV</button></div><div className="toolbar"><input className="search-input" placeholder="Cari barang, brand, customer…" value={keyword} onChange={e=>setKeyword(e.target.value)}/><select className="form-select" style={{width:'auto'}} value={eventFilter} onChange={e=>setEventFilter(e.target.value)}><option value="all">Semua event</option><option value="none">Tanpa event</option>{data.events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div><div className="table-wrap"><table className="data-table"><thead><tr><th>CUSTOMER / EVENT</th><th>BARANG</th><th>QTY</th><th>MODAL</th><th>TOTAL JUAL</th><th>LABA</th><th>STATUS</th></tr></thead><tbody>{itemsWithCustomer.map(i=>{const o=orderById(i.order_id);return <tr key={i.id}><td><strong>{customerNameById(o?.customer_id||'')}</strong><br/><small>{eventNameById(o?.event_id||null)}</small></td><td><strong>{i.brand} {i.product_name}</strong><br/><small>{i.variant}</small></td><td>{i.quantity}</td><td>{idr(i.quantity*i.cost_unit+i.shipping_cost)}</td><td>{idr(lineSales(i))}</td><td>{idr(lineProfit(i))}</td><td><span className={'pill '+(invoiceByItem.has(i.id)?'paid':'partial')}>{invoiceByItem.has(i.id)?'Invoiced':'Unbilled'}</span></td></tr>})}</tbody></table></div>{itemsWithCustomer.length===0&&<Empty text="Tidak ada barang sesuai pencarian."/>}</section>}
  {view==='invoices'&&<><section className="panel-card"><div className="panel-title"><div><h2>Buat invoice customer</h2><div className="panel-sub">Bisa gabungkan barang lintas event, tetapi setiap barang hanya boleh ditagih sekali.</div></div></div><form onSubmit={submitInvoice}><div className="form-grid three"><Field label="Customer"><select className="form-select" required value={invoiceCustomer} onChange={e=>{setInvoiceCustomer(e.target.value);setInvoiceSelected([]);}}><option value="">Pilih customer</option>{data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Jatuh tempo"><input type="date" className="form-input" value={invoiceDue} onChange={e=>setInvoiceDue(e.target.value)}/></Field><Field label="Catatan"><input className="form-input" value={invoiceNotes} onChange={e=>setInvoiceNotes(e.target.value)} placeholder="Opsional"/></Field></div><div className="section-mini">Pilih barang belum ditagih ({freeItems.length})</div>{invoiceCustomer?(freeItems.length?freeItems.map(item=>{const o=orderById(item.order_id);return <label className="check-row" key={item.id}><input type="checkbox" checked={invoiceSelected.includes(item.id)} onChange={()=>updateSelection(item.id)}/><span><strong>{item.product_name}</strong><br/><small className="muted">{eventNameById(o?.event_id||null)} · {item.quantity} pcs</small></span><strong>{idr(lineSales(item))}</strong></label>}):<Empty text="Semua barang customer sudah masuk invoice atau belum ada pesanan."/>):<div className="notice">Pilih customer terlebih dahulu untuk melihat daftar barang yang belum ditagihkan.</div>}<div className="section-foot"><strong>Barang dipilih: {invoiceSelected.length} • {idr(freeItems.filter(x=>invoiceSelected.includes(x.id)).reduce((s,x)=>s+lineSales(x),0))}</strong><button className="button button-dark" disabled={busy||!invoiceSelected.length}><FileText size={16}/> Buat invoice</button></div></form></section>
  <section className="panel-card"><div className="panel-title"><div><h2>Daftar invoice</h2><div className="panel-sub">Klik untuk verifikasi pembayaran QRIS setelah mencocokkan mutasi.</div></div><button className="button button-outline button-small" onClick={()=>downloadCsv('titiplen-invoice.csv',[['Nomor invoice','Customer','Total','Terbayar','Outstanding','Status'],...data.invoices.map(i=>[i.invoice_number,customerNameById(i.customer_id),invoiceTotal(data,i.id),paidTotal(data,i.id),invoiceBalance(data,i.id),invoiceStatus(data,i.id)])])}><Download size={15}/> Export CSV</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>TOTAL</th><th>DIBAYAR</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{data.invoices.slice().reverse().map(i=><tr key={i.id}><td><strong>{i.invoice_number}</strong><br/><small>{shortDate(i.created_at)}</small></td><td>{customerNameById(i.customer_id)}</td><td>{idr(invoiceTotal(data,i.id))}</td><td>{idr(paidTotal(data,i.id))}</td><td><span className={'pill '+(invoiceStatus(data,i.id)==='Lunas'?'paid':invoiceStatus(data,i.id)==='DP'?'partial':'unpaid')}>{invoiceStatus(data,i.id)}</span></td><td><button className="button button-outline button-small" onClick={()=>{setDetailInvoice(i.id);setPaymentAmount(0);setPaymentRef('');}}>Detail <ChevronRight size={14}/></button></td></tr>)}</tbody></table></div>{data.invoices.length===0&&<Empty text="Belum ada invoice. Buat invoice dari barang yang sudah dicatat."/>}</section>
  {currentInvoice&&<section className="panel-card" style={{borderColor:'#b7dccc'}}><div className="panel-title"><div><h2>Detail: {currentInvoice.invoice_number}</h2><div className="panel-sub">{customerNameById(currentInvoice.customer_id)} · jatuh tempo {shortDate(currentInvoice.due_date)}</div></div><button className="button button-ghost button-small" onClick={()=>setDetailInvoice('')}>Tutup ✕</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>BARANG</th><th>EVENT</th><th>TOTAL</th></tr></thead><tbody>{invoiceItems(data,currentInvoice).map(i=><tr key={i.id}><td>{i.quantity}× {i.brand} {i.product_name}</td><td>{eventNameById(orderById(i.order_id)?.event_id||null)}</td><td>{idr(lineSales(i))}</td></tr>)}</tbody></table></div><div className="section-foot"><span><strong>Total {idr(invoiceTotal(data,currentInvoice.id))}</strong> · Dibayar {idr(paidTotal(data,currentInvoice.id))}</span><strong>Sisa {idr(invoiceOutstanding)}</strong></div><div className="section-mini">Pembayaran terverifikasi</div>{data.payments.filter(p=>p.invoice_id===currentInvoice.id).map(p=><p className="small" key={p.id}>{shortDate(p.paid_at)} · {idr(p.amount)} · {p.method} · {p.reference||'Tanpa referensi'}</p>)}{invoiceOutstanding>0&&<form onSubmit={submitPayment}><div className="notice" style={{marginBottom:12}}>Periksa mutasi rekening/merchant QRIS dahulu. Jangan mengonfirmasi hanya berdasarkan chat atau screenshot customer.</div><div className="form-grid"><Field label="Nominal diterima"><Money value={paymentAmount} onChange={setPaymentAmount}/></Field><Field label="Referensi transaksi / mutasi"><input className="form-input" value={paymentRef} onChange={e=>setPaymentRef(e.target.value)} placeholder="Nomor / keterangan transaksi" required/></Field></div><div className="form-actions"><button disabled={busy||paymentAmount<=0||paymentAmount>invoiceOutstanding} className="button button-mint"><Check size={16}/> Verifikasi pembayaran</button></div></form>}</section>}</>}
  {view==='expenses'&&<><section className="panel-card"><div className="panel-title"><h2>Catat biaya operasional</h2></div><form onSubmit={submitExpense}><div className="form-grid three"><Field label="Dibebankan ke event"><select className="form-select" value={expenseEvent} onChange={e=>setExpenseEvent(e.target.value)}><option value="">Overhead umum</option>{data.events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><Field label="Kategori"><select className="form-select" value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)}>{['Transportasi','Parkir','Tiket','Penginapan','Helper','Admin bank','Operasional umum','Lain-lain'].map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Tanggal"><input className="form-input" type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/></Field><Field label="Deskripsi"><input className="form-input" value={expenseDesc} onChange={e=>setExpenseDesc(e.target.value)} placeholder="Mis. bensin pergi event"/></Field><Field label="Nominal pengeluaran"><Money value={expenseAmount} onChange={setExpenseAmount}/></Field></div><div className="form-actions"><button className="button button-dark" disabled={busy}><Save size={16}/> Simpan pengeluaran</button></div></form></section><section className="panel-card"><div className="panel-title"><h2>Rekap pengeluaran</h2><button className="button button-outline button-small" onClick={()=>downloadCsv('titiplen-pengeluaran.csv',[['Tanggal','Event','Kategori','Keterangan','Nominal'],...data.expenses.map(e=>[e.spent_at,eventNameById(e.event_id),e.category,e.description,e.amount])])}><Download size={15}/> Export CSV</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>TANGGAL</th><th>ALOKASI</th><th>KATEGORI</th><th>DESKRIPSI</th><th>NOMINAL</th></tr></thead><tbody>{data.expenses.map(x=><tr key={x.id}><td>{shortDate(x.spent_at)}</td><td>{x.event_id?eventNameById(x.event_id):'Overhead umum'}</td><td>{x.category}</td><td>{x.description||'—'}</td><td><strong>{idr(x.amount)}</strong></td></tr>)}</tbody></table></div><div className="section-foot"><strong>Total pengeluaran</strong><strong>{idr(report.expenses)}</strong></div></section></>}
  {view==='settings'&&<section className="panel-card"><div className="panel-title"><div><h2>Pengaturan pembayaran</h2><div className="panel-sub">Nomor WhatsApp harus nomor admin penerima konfirmasi QRIS.</div></div><Settings2 size={20}/></div><form onSubmit={submitSettings}><div className="form-grid"><Field label="Nama usaha"><input className="form-input" value={businessName} onChange={e=>setBusinessName(e.target.value)} required/></Field><Field label="WhatsApp admin (628... tanpa +)"><input className="form-input" value={waNumber} onChange={e=>setWaNumber(e.target.value.replace(/\D/g,''))} placeholder="6281234567890"/></Field><div className="field-wide"><Field label="URL gambar QRIS statis (HTTPS)"><input className="form-input" value={qrisUrl} onChange={e=>setQrisUrl(e.target.value)} placeholder="https://.../qris-titiplen.png"/></Field></div></div><div className="notice" style={{marginTop:16}}>Simpan gambar QRIS pada hosting privat yang menghasilkan URL publik hanya untuk aset QRIS (misalnya Supabase Storage bucket khusus QRIS). Jangan gunakan URL gambar dari mutasi rekening atau bukti bayar. Pastikan QRIS atas nama merchant Titiplen sebelum mengaktifkan pembayaran.</div>{qrisUrl&&<div style={{marginTop:15}}><img alt="Pratinjau QRIS statis" src={qrisUrl} style={{width:160,maxWidth:'100%',borderRadius:12}}/></div>}<div className="form-actions"><button className="button button-dark" disabled={busy}><Save size={16}/> Simpan pengaturan</button></div></form>{isDemo&&<div className="section-foot"><span className="small muted">Reset semua data demo ke sampel awal</span><button className="button button-warn button-small" onClick={()=>{if(window.confirm('Hapus seluruh perubahan data demo di browser ini?')){resetDemo();void reload();setNotice('Demo dikembalikan ke data contoh.');}}}><RefreshCw size={15}/> Reset demo</button></div>}</section>}
  </main></div>;
}