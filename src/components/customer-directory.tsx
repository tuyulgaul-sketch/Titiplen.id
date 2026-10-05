'use client';

import {useMemo,useRef,useState,type FormEvent} from 'react';
import {Check,CheckCircle2,ChevronLeft,ChevronRight,Download,FileSpreadsheet,Pencil,Plus,Search,ShieldCheck,Upload,Users,X} from 'lucide-react';
import {getSupabase,isDemo} from '@/lib/supabase';
import {normalizePhone} from '@/lib/finance';
import {insertDemo,renameCustomerDemo,upsertWagMembersDemo} from '@/lib/demo';
import {readMemberFile,type MemberImportPreview} from '@/lib/member-import';
import type {Customer,StoreData} from '@/lib/types';

type Props={data:StoreData;onDataChanged:()=>Promise<void>};
type Summary={added:number;renamed:number;unchanged:number;processed:number};

function downloadCsv(filename:string,rows:string[][]){
 const csv='\uFEFF'+rows.map(row=>row.map(x=>'"'+(
   // Stop spreadsheet apps from executing CSV formulas in member display labels.
   /^[=+\-@\t\r]/.test(x)?'\''+x:x
 ).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
 anchor.click();URL.revokeObjectURL(url);
}
const capitalizeFirst=(x:string)=>x.trim();
const phoneMatches=(c:Customer,term:string)=>(c.name+' '+c.phone_e164+' '+(c.wag_saved_name||'')).toLocaleLowerCase('id-ID').includes(term.toLocaleLowerCase('id-ID'));
export function CustomerDirectory({data,onDataChanged}:Props){
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(0);
 const [onlyWag,setOnlyWag]=useState(false);
 const [newName,setNewName]=useState('');
 const [newPhone,setNewPhone]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [editId,setEditId]=useState('');
 const [editedName,setEditedName]=useState('');
 const [preview,setPreview]=useState<MemberImportPreview|null>(null);
 const [filename,setFilename]=useState('');
 const [mode,setMode]=useState<'new'|'update'>('new');
 const [processed,setProcessed]=useState(0);
 const [lastSummary,setLastSummary]=useState<Summary|null>(null);
 const fileRef=useRef<HTMLInputElement>(null);
 const members=useMemo(()=>data.customers.filter(c=>(!onlyWag||c.is_wag_member)&&phoneMatches(c,query.trim())).slice().sort((a,b)=>a.name.localeCompare(b.name,'id-ID')),[data.customers,onlyWag,query]);
 const pages=Math.max(1,Math.ceil(members.length/40));
 const safePage=Math.min(page,pages-1);
 const shown=members.slice(safePage*40,(safePage+1)*40);
 const customerPhones=useMemo(()=>new Map(data.customers.map(c=>[c.phone_e164,c])),[data.customers]);
 const importNew=preview?.rows.filter(r=>!customerPhones.has(r.phone)).length||0;
 const importExisting=(preview?.rows.length||0)-importNew;
 const matchingRename=(preview?.rows||[]).filter(r=>{
  const existing=customerPhones.get(r.phone);
  return existing&&!r.generated&&existing.name!==r.name;
 }).length;
 const memberCount=data.customers.filter(c=>c.is_wag_member).length;

 async function saveCustomer(e:FormEvent){
  e.preventDefault();setError('');setNotice('');
  const phone=normalizePhone(newPhone);
  if(!phone){setError('Masukkan nomor HP Indonesia yang valid (08… atau +62…).');return;}
  const name=capitalizeFirst(newName);
  if(name.length<2||name.length>120){setError('Nama member harus 2–120 karakter.');return;}
  if(customerPhones.has(phone)){setError('Nomor HP sudah ada di database. Gunakan tombol Rename pada baris member tersebut.');return;}
  setSaving(true);
  try{
   if(isDemo)insertDemo('customers',{name,phone_e164:phone,is_wag_member:true,wag_saved_name:name,wag_last_imported_at:new Date().toISOString()});
   else {
    const r=await getSupabase().from('customers').insert({name,phone_e164:phone,is_wag_member:true,wag_saved_name:name});
    if(r.error)throw r.error;
   }
   setNewName('');setNewPhone('');
   await onDataChanged();
   setNotice('Member '+name+' berhasil disimpan dan tersedia untuk pesanan/invoice.');
  }catch(err){setError(err instanceof Error?err.message:'Gagal menambahkan member.');}
  finally{setSaving(false);}
 }
 function beginRename(customer:Customer){
  setEditId(customer.id);setEditedName(customer.name);setNotice('');setError('');
 }
 async function saveRename(e:FormEvent){
  e.preventDefault();
  const name=editedName.trim();setError('');
  if(name.length<2||name.length>120){setError('Nama harus 2–120 karakter.');return;}
  const existing=data.customers.find(x=>x.id===editId);
  if(!existing){setError('Member tidak ditemukan.');return;}
  if(existing.name===name){setEditId('');return;}
  setSaving(true);
  try{
   if(isDemo)renameCustomerDemo(editId,name);
   else{
    const r=await getSupabase().from('customers').update({name,name_changed_at:new Date().toISOString()}).eq('id',editId);
    if(r.error)throw r.error;
   }
   setEditId('');await onDataChanged();
   setNotice('Nama tampilan berhasil diubah. Nomor HP dan histori invoice tetap sama.');
  }catch(err){setError(err instanceof Error?err.message:'Gagal rename member.');}
  finally{setSaving(false);}
 }
 async function selectFile(file:File|undefined){
  if(!file)return;
  setPreview(null);setError('');setNotice('');setLastSummary(null);setFilename(file.name);
  try{
   const next=await readMemberFile(file);
   if(next.issues.length){setError('Ada '+next.issues.length+' baris perlu dibetulkan. Periksa nomor HP yang invalid atau duplikat sebelum upload.');}
   else if(next.rows.length===0){setError('Tidak ada data member yang dapat diimpor.');}
   setPreview(next);
  }catch(err){setError(err instanceof Error?err.message:'File tidak dapat dibaca.');}
  if(fileRef.current)fileRef.current.value='';
 }
 async function executeBulk(){
  if(!preview||preview.rows.length===0||preview.issues.length)return;
  setSaving(true);setError('');setNotice('');setProcessed(0);
  let added=0,renamed=0,unchanged=0,processedCount=0;
  try{
   // Keep network write payloads manageable; each RPC batch is atomic and idempotent.
   for(let start=0;start<preview.rows.length;start+=150){
    const group=preview.rows.slice(start,start+150).map(r=>{
     const existing=customerPhones.get(r.phone);
     // A missing contact name in Excel must NEVER overwrite a curated name.
     const name=(existing&&r.generated)?existing.name:r.name;
     return {phone:r.phone,name,saved_name:r.saved_name};
    });
    let result:Summary;
    if(isDemo)result=upsertWagMembersDemo(group,mode==='update');
    else{
     const r=await getSupabase().rpc('upsert_titiplen_wag_members',{
       p_members:group,p_update_names:mode==='update'
     });
     if(r.error)throw r.error;
     result=r.data as Summary;
    }
    added+=result.added;renamed+=result.renamed;unchanged+=result.unchanged;
    processedCount+=result.processed;
    setProcessed(processedCount);
   }
   setLastSummary({added,renamed,unchanged,processed:processedCount});
   setPreview(null);setFilename('');
   setPage(0);
   await onDataChanged();
   setNotice('Selesai. '+added+' member baru, '+renamed+' nama diperbarui, '+unchanged+' nomor sudah ada.');
  }catch(err){
   try{await onDataChanged();}catch{}
   setError('Upload terhenti pada baris setelah '+processedCount+'. Batch yang berhasil sudah tersimpan. Ulangi file yang sama untuk melanjutkan tanpa membuat nomor ganda. Detail: '+(err instanceof Error?err.message:String(err)));
  }finally{setSaving(false);}
 }

 return <div className="member-directory">
  <div className="member-kpis">
   <div><Users size={19}/><span>Total customer</span><strong>{data.customers.length}</strong></div>
   <div><ShieldCheck size={19}/><span>Member WAG</span><strong>{memberCount}</strong></div>
   <div><FileSpreadsheet size={19}/><span>Tanpa label WAG</span><strong>{data.customers.length-memberCount}</strong></div>
  </div>
  {error&&<div className="inline-error" role="alert">{error}</div>}
  {notice&&<div className="inline-success" role="status"><CheckCircle2 size={16}/> {notice}</div>}
  <section className="panel-card">
   <div className="panel-title"><div><h2>Tambah member satu per satu</h2><div className="panel-sub">Data langsung dapat dipakai saat mencatat pembelian di event.</div></div><span className="chip">Nomor HP unik</span></div>
   <form className="form-grid" onSubmit={saveCustomer}>
     <label><span className="form-label">Nama tampilan member</span><input className="form-input" value={newName} maxLength={120} onChange={e=>setNewName(e.target.value)} placeholder="Nama customer" required/></label>
     <label><span className="form-label">WhatsApp / No HP</span><input className="form-input" value={newPhone} onChange={e=>setNewPhone(e.target.value)} inputMode="tel" placeholder="081234567890" required/></label>
     <div className="field-wide form-actions"><button className="button button-dark" disabled={saving}><Plus size={16}/> Simpan member</button></div>
   </form>
  </section>
  <section className="panel-card">
   <div className="panel-title"><div><h2>Upload Excel / CSV member</h2><div className="panel-sub">Tambah atau update ratusan member sekali jalan, cocok untuk ekspor daftar WAG berikutnya.</div></div><FileSpreadsheet size={21} color="#A04471"/></div>
   <div className="bulk-upload-bar">
    <input ref={fileRef} aria-label="Pilih file Excel member" type="file" accept=".xlsx,.csv" style={{display:'none'}} onChange={e=>void selectFile(e.target.files?.[0])}/>
    <button type="button" disabled={saving} className="button button-outline" onClick={()=>fileRef.current?.click()}><Upload size={16}/> Pilih file Excel / CSV</button>
    <button type="button" className="button button-ghost button-small" onClick={()=>downloadCsv('Template_Member_Titiplen.csv',[['Nomor HP','Nama'],['081234567890','Contoh Nama']])}><Download size={15}/> Unduh template CSV</button>
   </div>
   <div className="notice" style={{marginTop:13}}>Mendukung format file lama: <strong>phone number</strong> dan <strong>saved name</strong>; atau file sederhana dengan kolom <strong>Nomor HP</strong> dan <strong>Nama</strong>. Import tidak menghapus member yang absen dari Excel terbaru.</div>
   {preview&&<div className="member-preview">
    <div className="panel-title"><div><h3>Pratinjau: {filename}</h3><div className="panel-sub">{preview.sourceRows} baris · {preview.rows.length} nomor valid · {preview.issues.length} perlu diperbaiki</div></div><button type="button" className="square-button" title="Tutup preview" onClick={()=>{setPreview(null);setFilename('');setError('');}}><X size={17}/></button></div>
    <div className="member-preview-stats">
      <div><span>Nomor baru</span><strong>{importNew}</strong></div>
      <div><span>Nomor sudah ada</span><strong>{importExisting}</strong></div>
      <div><span>Nama sementara</span><strong>{preview.generatedCount}</strong></div>
      <div><span>Potensi rename</span><strong>{matchingRename}</strong></div>
    </div>
    {preview.issues.length>0&&<div className="inline-error" style={{marginTop:12}}>Contoh kendala: {preview.issues.slice(0,6).map(x=>'Baris '+x.row+': '+x.message).join('; ')}{preview.issues.length>6?' …':''}</div>}
    <div className="member-bulk-mode" role="group" aria-label="Metode pembaruan member">
      <label className={mode==='new'?'selected':''}><input type="radio" name="import-mode" checked={mode==='new'} onChange={()=>setMode('new')}/><span><strong>Tambah nomor baru saja</strong><small>Nama yang sudah diedit Helen tetap aman. Nomor existing hanya ditandai sebagai member WAG.</small></span></label>
      <label className={mode==='update'?'selected':''}><input type="radio" name="import-mode" checked={mode==='update'} onChange={()=>setMode('update')}/><span><strong>Tambah & update nama</strong><small>Nama existing diperbarui jika Excel memuat nama yang jelas. Label berupa nomor HP tidak mengganti nama yang sudah dirapikan.</small></span></label>
    </div>
    <div className="member-example-table"><table className="data-table"><thead><tr><th>NO HP</th><th>NAMA TAMPILAN</th><th>KETERANGAN</th></tr></thead><tbody>{preview.rows.slice(0,8).map(r=><tr key={r.phone}><td>{r.phone}</td><td>{r.name}</td><td>{r.generated?'Nama sementara':customerPhones.has(r.phone)?'Nomor sudah ada':'Member baru'}</td></tr>)}</tbody></table></div>
    {preview.rows.length>8&&<small className="muted">Menampilkan 8 dari {preview.rows.length} baris. Semua baris valid akan diproses.</small>}
    <div className="form-actions"><button type="button" className="button button-dark" onClick={()=>void executeBulk()} disabled={saving||preview.issues.length>0||preview.rows.length===0}><Upload size={17}/>{saving?'Mengimpor '+processed+'/'+preview.rows.length+'…':'Konfirmasi upload '+preview.rows.length+' member'}</button></div>
   </div>}
   {lastSummary&&<div className="notice" style={{marginTop:15}}>Upload terakhir: {lastSummary.processed} diproses · {lastSummary.added} baru · {lastSummary.renamed} rename · {lastSummary.unchanged} nomor existing.</div>}
  </section>
  <section className="panel-card">
    <div className="panel-title"><div><h2>Daftar member & customer</h2><div className="panel-sub">Klik <strong>Rename</strong> untuk mengubah nama tanpa memengaruhi nomor HP atau invoice.</div></div><button type="button" className="button button-outline button-small" onClick={()=>downloadCsv('Daftar_Member_Titiplen.csv',[['Nama tampilan','Nomor HP','Member WAG','Nama di Excel'],...members.map(c=>[c.name,c.phone_e164,c.is_wag_member?'Ya':'Tidak',c.wag_saved_name||''])])}><Download size={16}/> Export CSV</button></div>
    <div className="member-filters">
      <div className="member-search"><Search size={16}/><input type="search" placeholder="Cari nama atau nomor WhatsApp…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} /></div>
      <label className="member-wag-toggle"><input type="checkbox" checked={onlyWag} onChange={e=>{setOnlyWag(e.target.checked);setPage(0);}}/> Member WAG saja</label>
    </div>
    <div className="member-record-count">Menampilkan {members.length?Math.min(safePage*40+1,members.length):0}–{Math.min((safePage+1)*40,members.length)} dari {members.length} customer</div>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>NAMA MEMBER</th><th>NOMOR WHATSAPP</th><th>ASAL</th><th>ORDER</th><th>AKSI</th></tr></thead><tbody>
      {shown.map(c=><tr key={c.id}>
       <td><strong>{c.name}</strong>{c.wag_saved_name&&c.wag_saved_name!==c.name&&<div className="member-original-name">Dari Excel: {c.wag_saved_name}</div>}</td>
       <td>{c.phone_e164}</td>
       <td>{c.is_wag_member?<span className="pill paid">Member WAG</span>:<span className="pill partial">Manual</span>}</td>
       <td>{data.orders.filter(o=>o.customer_id===c.id).length}</td>
       <td><button className="button button-outline button-small" type="button" onClick={()=>beginRename(c)}><Pencil size={14}/> Rename</button></td>
      </tr>)}
    </tbody></table></div>
    {!shown.length&&<p className="notice">Tidak ada member yang sesuai dengan pencarian ini.</p>}
    {pages>1&&<div className="member-pagination"><button type="button" className="button button-outline button-small" disabled={safePage===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ChevronLeft size={14}/> Sebelumnya</button><span>Halaman {safePage+1} / {pages}</span><button type="button" className="button button-outline button-small" disabled={safePage===pages-1} onClick={()=>setPage(p=>p+1)}>Selanjutnya <ChevronRight size={14}/></button></div>}
  </section>
  {editId&&<div className="member-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setEditId('');}}>
   <form role="dialog" aria-modal="true" aria-label="Rename member" className="member-rename-dialog" onSubmit={saveRename}>
     <div className="panel-title"><div><h2>Rename member</h2><p className="panel-sub">Nomor HP tetap sama; pesanan dan invoice tidak berubah.</p></div><button type="button" className="square-button" disabled={saving} onClick={()=>setEditId('')} aria-label="Tutup"><X size={17}/></button></div>
     <label><span className="form-label">Nama baru</span><input autoFocus className="form-input" maxLength={120} minLength={2} value={editedName} onChange={e=>setEditedName(e.target.value)} required/></label>
     <p className="member-dialog-phone">HP: {data.customers.find(c=>c.id===editId)?.phone_e164||'—'}</p>
     <div className="form-actions"><button type="button" className="button button-outline" disabled={saving} onClick={()=>setEditId('')}>Batal</button><button className="button button-dark" disabled={saving}><Check size={16}/>{saving?'Menyimpan…':'Simpan nama'}</button></div>
   </form>
  </div>}
 </div>;
}
