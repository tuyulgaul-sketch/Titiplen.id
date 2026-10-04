'use client';

import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {BrandMark} from '@/components/brand-mark';
import {ArrowLeft,Mail,ShieldCheck,ShoppingBag} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';

export default function ResetPasswordPage(){
  const [email,setEmail]=useState('');
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');
  async function submit(e:FormEvent){
    e.preventDefault();
    setSending(true);setError('');
    try{
      const redirectTo=window.location.origin+'/auth/accept-invite';
      const {error:failure}=await getSupabase().auth.resetPasswordForEmail(email.trim(),{redirectTo});
      if(failure)throw failure;
      setSent(true);
    }catch(err){setError(err instanceof Error?err.message:'Gagal mengirim email pemulihan.');}
    finally{setSending(false);}
  }
  return <main className="auth-box">
    <BrandMark/>
    <div style={{marginTop:24}}><ShieldCheck size={30} color="#A04471"/></div>
    <h1>{sent?'Periksa email kamu':'Buat ulang password'}</h1>
    {sent?<><p>Jika email terdaftar, tautan pemulihan sudah diminta. Buka pesan terbaru dari Supabase/Titiplen dan lanjutkan untuk membuat password di situs ini. Jangan bagikan tautan kepada orang lain.</p><Link href="/admin" className="button button-outline" style={{width:'100%'}}>Kembali ke login</Link></>:
    <><p>Khusus akun admin yang sudah diundang. Masukkan email akun kamu agar sistem mengirim tautan untuk membuat password.</p>
    {error&&<div className="inline-error">{error}</div>}
    <form onSubmit={submit}>
      <label className="form-label">Alamat email admin</label>
      <input className="form-input" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" required/>
      <button className="button button-dark" style={{width:'100%',marginTop:17}} disabled={sending}><Mail size={17}/>{sending?'Mengirim…':'Kirim tautan pemulihan'}</button>
    </form><Link href="/admin" className="back-link" style={{marginTop:15}}><ArrowLeft size={15}/> Kembali ke login</Link>
    </>}
  </main>;
}
