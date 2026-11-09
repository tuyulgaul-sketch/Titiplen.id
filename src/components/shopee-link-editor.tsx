'use client';
import {useState,type FormEvent} from 'react';
import {Check,ShoppingBag} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';

type Event={id:string;shopee_checkout_url:string|null};
const valid=(value:string)=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&(u.hostname==='shopee.co.id'||u.hostname.endsWith('.shopee.co.id'));
 }catch{return false}
};
export function ShopeeLinkEditor({event,onSaved}:{event:Event;onSaved:()=>Promise<void>}){
 const [link,setLink]=useState(event.shopee_checkout_url||'');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setError('');setSaved(false);
  const next=link.trim();
  if(next&&!valid(next)){setError('Gunakan link HTTPS Shopee.co.id yang valid.');return;}
  setBusy(true);
  try{
   const {error:err}=await getSupabase().from('events').update({shopee_checkout_url:next||null}).eq('id',event.id);
   if(err)throw err;
   setSaved(true);await onSaved();
  }catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan link Shopee');}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} style={{flexBasis:'100%'}}>
  <label className="oo-label"><ShoppingBag size={14} style={{display:'inline',verticalAlign:'middle'}}/> Link checkout Shopee event (opsional)</label>
  <div className="oo-row"><input className="oo-input" style={{flex:1,minWidth:200}} type="url" placeholder="https://shopee.co.id/..." value={link} onChange={e=>{setLink(e.target.value);setSaved(false)}}/>
  <button className="oo-button" type="submit" disabled={busy}><Check size={15}/>{busy?'Menyimpan…':'Simpan Link'}</button></div>
  <div className="oo-muted" style={{marginTop:5}}>Ini link yang disediakan admin, bukan integrasi otomatis API checkout Shopee. Kalau kosong, customer tetap bisa memilih Shopee dan admin akan memberi instruksi.</div>
  {saved&&<div className="oo-message success">Link Shopee event tersimpan.</div>}
  {error&&<div className="oo-message error">{error}</div>}
 </form>;
}