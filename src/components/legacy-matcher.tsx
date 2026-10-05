'use client';

import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,ChevronDown,ChevronRight,Link2,PackageSearch,RefreshCw,Search,Users} from 'lucide-react';
import {getSupabase,isDemo} from '@/lib/supabase';
import {idr} from '@/lib/finance';
import {SearchableSelect} from '@/components/searchable-select';
import type {Customer} from '@/lib/types';

type LegacyRow={
 id:string;source_row:number;legacy_customer_name:string;brand:string;product_name:string;variant:string;
 quantity:number|null;cost_total:number|null;fee_total:number|null;extra_fee_total:number|null;
 shipping_total:number|null;discount_total:number|null;sale_total:number|null;legacy_profit:number|null;
 legacy_payment_status:string;source_note:string;event_name:string;payment_flag:string;
 customer_id:string|null;matched_at:string|null;
};
type Props={customers:Customer[]};
const PAGE=24;

export function LegacyMatcher({customers}:Props){
 const [rows,setRows]=useState<LegacyRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [query,setQuery]=useState('');
 const [showMatched,setShowMatched]=useState(false);
 const [page,setPage]=useState(0);
 const [expanded,setExpanded]=useState('');
 const [busy,setBusy]=useState('');
 const customerById=useMemo(()=>new Map(customers.map(c=>[c.id,c])),[customers]);
 const customerOptions=useMemo(()=>customers.slice().sort((a,b)=>a.name.localeCompare(b.name,'id')).map(c=>({
  value:c.id,label:c.name,meta:c.phone_e164,searchText:c.phone_e164+' '+(c.wag_saved_name||'')
 })),[customers]);

 async function load(){
  if(isDemo){setRows([]);setLoading(false);return;}
  setLoading(true);setError('');
  try{
   const all:LegacyRow[]=[];
   for(let from=0;;from+=1000){
    const r=await getSupabase().from('legacy_item_imports').select('*').order('source_row',{ascending:true}).range(from,from+999);
    if(r.error)throw r.error;
    all.push(...(r.data as LegacyRow[]));
    if((r.data||[]).length<1000)break;
   }
   setRows(all);
  }catch(e){setError(e instanceof Error?e.message:'Gagal memuat rekap lama.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);

 const groups=useMemo(()=>{
  const map=new Map<string,LegacyRow[]>();
  for(const row of rows){
   const list=map.get(row.legacy_customer_name)||[];list.push(row);map.set(row.legacy_customer_name,list);
  }
  return [...map.entries()].map(([name,items])=>{
   const matchedIds=[...new Set(items.map(x=>x.customer_id).filter(Boolean))] as string[];
   const allSame=matchedIds.length===1&&items.every(x=>x.customer_id===matchedIds[0]);
   const events=[...new Set(items.map(x=>x.event_name).filter(Boolean))];
   return {
    name,items,matchedId:allSame?matchedIds[0]:'',
    matchedCount:items.filter(x=>x.customer_id).length,
    total:items.reduce((s,x)=>s+(x.sale_total||0),0),
    events
   };
  }).sort((a,b)=>a.name.localeCompare(b.name,'id'));
 },[rows]);
 const visible=groups.filter(g=>{
  const text=(g.name+' '+g.events.join(' ')+' '+g.items.map(x=>x.brand+' '+x.product_name).join(' ')).toLocaleLowerCase('id-ID');
  if(query&&!text.includes(query.toLocaleLowerCase('id-ID')))return false;
  if(!showMatched&&g.items.every(x=>x.customer_id))return false;
  return true;
 });
 const pageCount=Math.max(1,Math.ceil(visible.length/PAGE)),safePage=Math.min(page,pageCount-1);
 const shown=visible.slice(safePage*PAGE,(safePage+1)*PAGE);
 const matchedRows=rows.filter(x=>x.customer_id).length;
 const matchedGroups=groups.filter(g=>g.items.every(x=>x.customer_id)).length;

 async function matchGroup(name:string,customerId:string){
  if(!customerId)return;
  setBusy('g:'+name);setError('');setNotice('');
  try{
   const r=await getSupabase().rpc('match_titiplen_legacy_group',{p_legacy_name:name,p_customer:customerId});
   if(r.error)throw r.error;
   await load();
   const c=customerById.get(customerId);
   setNotice(String(r.data)+' baris "'+name+'" sudah dicocokkan ke '+(c?.name||'member terpilih')+'.');
  }catch(e){setError(e instanceof Error?e.message:'Gagal mencocokkan member.');}
  finally{setBusy('');}
 }
 async function matchRow(id:string,customerId:string){
  if(!customerId)return;
  setBusy('r:'+id);setError('');setNotice('');
  try{
   const r=await getSupabase().rpc('match_titiplen_legacy_item',{p_item:id,p_customer:customerId});
   if(r.error)throw r.error;
   await load();
   setNotice('Satu baris barang berhasil dipindahkan ke member yang dipilih.');
  }catch(e){setError(e instanceof Error?e.message:'Gagal mencocokkan baris.');}
  finally{setBusy('');}
 }

 if(loading)return <section className="panel-card legacy-loading"><div className="spinner"/><p>Memuat rekap barang lama…</p></section>;
 return <div className="legacy-matcher">
   <div className="legacy-kpis">
     <div><PackageSearch size={18}/><span>Baris historis</span><strong>{rows.length}</strong></div>
     <div><Users size={18}/><span>Nama lama</span><strong>{groups.length}</strong></div>
     <div><Link2 size={18}/><span>Sudah cocok</span><strong>{matchedRows}/{rows.length}</strong></div>
   </div>
   {error&&<div className="inline-error" role="alert">{error}</div>}
   {notice&&<div className="inline-success" role="status"><CheckCircle2 size={16}/>{notice}</div>}
   <section className="panel-card">
     <div className="panel-title">
       <div><h2>Cocokkan rekap lama ke member</h2><div className="panel-sub">Cari nama lama, buka kelompok barang, lalu pilih customer berdasarkan <strong>nama atau nomor HP</strong>. Pencocokan ini belum membuat invoice baru.</div></div>
       <button className="button button-outline button-small" type="button" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button>
     </div>
     <div className="legacy-toolbar">
       <div className="member-search"><Search size={16}/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Cari nama lama, barang, brand, event…"/></div>
       <label className="member-wag-toggle"><input type="checkbox" checked={showMatched} onChange={e=>{setShowMatched(e.target.checked);setPage(0);}}/> Tampilkan yang sudah dicocokkan</label>
     </div>
     {!rows.length&&<div className="notice">Rekap historis belum tersedia di database.</div>}
     <div className="legacy-groups">
       {shown.map(g=>{
        const open=expanded===g.name;
        const matchedCustomer=g.matchedId?customerById.get(g.matchedId):null;
        return <article className={'legacy-group '+(g.matchedCount===g.items.length?'matched':'')} key={g.name}>
          <div className="legacy-group-head">
            <button className="legacy-expand" type="button" onClick={()=>setExpanded(open?'':g.name)} aria-expanded={open}>{open?<ChevronDown size={17}/>:<ChevronRight size={17}/>}</button>
            <div className="legacy-group-main">
              <strong>{g.name}</strong>
              <span>{g.items.length} baris · {g.events.length?g.events.slice(0,2).join(', '):'Tanpa event'}{g.events.length>2?' +'+(g.events.length-2):''}</span>
            </div>
            <div className="legacy-group-total">{idr(g.total)}</div>
            <div className="legacy-match-control">
              <SearchableSelect
                value={g.matchedId}
                onChange={value=>void matchGroup(g.name,value)}
                disabled={!!busy}
                placeholder={g.matchedCount?String(g.matchedCount)+'/'+String(g.items.length)+' sudah cocok':'Cari member / nomor HP…'}
                searchPlaceholder="Ketik nama atau nomor HP…"
                options={customerOptions}
              />
            </div>
          </div>
          {matchedCustomer&&<div className="legacy-match-result"><CheckCircle2 size={14}/> Semua baris → <strong>{matchedCustomer.name}</strong> · {matchedCustomer.phone_e164}</div>}
          {open&&<div className="legacy-items">
            {g.items.map(row=>{
             const assigned=row.customer_id?customerById.get(row.customer_id):null;
             return <div className="legacy-item" key={row.id}>
               <div className="legacy-item-info">
                 <span className="legacy-source-row">Excel #{row.source_row}</span>
                 <strong>{row.brand?row.brand+' · ':''}{row.product_name||'Tanpa nama barang'}</strong>
                 <small>{row.variant||'Tanpa varian'} · Qty {row.quantity??'—'} · {row.event_name||'Tanpa event'} · {row.legacy_payment_status||'Status kosong'}</small>
               </div>
               <div className="legacy-item-money"><span>Harga lama</span><strong>{idr(row.sale_total||0)}</strong></div>
               <div className="legacy-row-match">
                 <SearchableSelect
                  value={row.customer_id||''}
                  onChange={value=>void matchRow(row.id,value)}
                  disabled={!!busy}
                  placeholder="Pilih member…"
                  searchPlaceholder="Cari nama / nomor HP…"
                  options={customerOptions}
                 />
                 {assigned&&<small>{assigned.phone_e164}</small>}
               </div>
             </div>;
            })}
          </div>}
        </article>;
       })}
     </div>
     {visible.length>PAGE&&<div className="member-pagination"><button className="button button-outline button-small" type="button" disabled={safePage===0} onClick={()=>setPage(x=>Math.max(0,x-1))}>Sebelumnya</button><span>Halaman {safePage+1}/{pageCount} · {visible.length} nama</span><button className="button button-outline button-small" type="button" disabled={safePage>=pageCount-1} onClick={()=>setPage(x=>x+1)}>Selanjutnya</button></div>}
     <div className="legacy-footnote">Progress pencocokan nama: <strong>{matchedGroups}/{groups.length}</strong> kelompok selesai. Nilai dari Excel lama disimpan apa adanya dan belum dihitung ke dashboard live.</div>
   </section>
 </div>;
}
