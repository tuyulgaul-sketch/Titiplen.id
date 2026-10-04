'use client';

import {useEffect, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {BrandMark} from '@/components/brand-mark';
import {CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, ShoppingBag} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';

/** Invited admin may establish a password only after Supabase Auth creates a valid session. */
export default function AcceptInvite(){
  const [status,setStatus]=useState<'checking'|'ready'|'saving'|'success'|'invalid'>('checking');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [show,setShow]=useState(false);
  const [error,setError]=useState('');
  const [email,setEmail]=useState('');

  useEffect(()=>{
    const sb=getSupabase();
    let alive=true;
    const check=async()=>{
      const {data:{user},error:userError}=await sb.auth.getUser();
      if(!alive)return;
      if(userError||!user){setStatus('invalid');return;}
      if(!user.email){setStatus('invalid');return;}
      setEmail(user.email);setStatus('ready');
    };
    const {data:{subscription}}=sb.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_IN'||event==='PASSWORD_RECOVERY'){
        // Re-check user with the Auth server, rather than trusting a URL fragment.
        void check();
      }
    });
    // Give the browser SDK a chance to process the hash / PKCE callback.
    void check();
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);

  async function save(event:FormEvent){
    event.preventDefault();setError('');
    if(password.length<10){setError('Gunakan password minimal 10 karakter.');return;}
    if(password!==confirm){setError('Konfirmasi password tidak cocok.');return;}
    setStatus('saving');
    try{
      const sb=getSupabase();
      const {data:{user},error:sessionError}=await sb.auth.getUser();
      if(sessionError||!user?.email)throw new Error('Sesi aktivasi tidak berlaku lagi. Minta undangan baru.');
      const {error:updateError}=await sb.auth.updateUser({password});
      if(updateError)throw updateError;
      setPassword('');setConfirm('');setStatus('success');
    }catch(e){setError(e instanceof Error?e.message:'Gagal membuat password.');setStatus('ready');}
  }

  return <main className="auth-box">
    <BrandMark/>
    {status==='checking'&&<><div className="spinner"/><p style={{textAlign:'center'}}>Memeriksa tautan aktivasi…</p></>}
    {status==='invalid'&&<><KeyRound size={30} color="#b97560" style={{marginTop:22}}/><h1>Tautan tidak valid</h1><p>Link undangan mungkin sudah digunakan atau kedaluwarsa. Hubungi pengelola Titiplen untuk meminta tautan aktivasi ulang.</p><Link href="/admin" className="button button-outline" style={{width:'100%'}}>Kembali ke login</Link></>}
    {(status==='ready'||status==='saving')&&<>
      <ShieldCheck size={30} color="#A04471" style={{marginTop:22}}/>
      <h1>Aktivasi akun admin</h1>
      <p>Selamat datang{email?' '+email:''}. Buat password pribadi untuk masuk ke workspace Titiplen. Jangan bagikan password ke siapa pun.</p>
      {error&&<div className="inline-error">{error}</div>}
      <form onSubmit={save}>
        <label className="form-label">Password baru (minimal 10 karakter)</label>
        <div style={{position:'relative'}}>
          <input className="form-input" type={show?'text':'password'} value={password} autoComplete="new-password" onChange={e=>setPassword(e.target.value)} required minLength={10} placeholder="Buat password yang kuat" style={{paddingRight:46}}/>
          <button type="button" aria-label={show?'Sembunyikan password':'Tampilkan password'} onClick={()=>setShow(!show)} style={{position:'absolute',right:10,top:9,border:0,background:'transparent',color:'#755C6B'}}>{show?<EyeOff size={20}/>:<Eye size={20}/>}</button>
        </div>
        <label className="form-label" style={{marginTop:15}}>Ulangi password</label>
        <input className="form-input" type={show?'text':'password'} value={confirm} autoComplete="new-password" onChange={e=>setConfirm(e.target.value)} required minLength={10} placeholder="Ulangi password"/>
        <button className="button button-dark" style={{width:'100%',marginTop:20}} disabled={status==='saving'}>{status==='saving'?'Menyimpan…':'Aktifkan akun & simpan password'}</button>
      </form>
    </>}
    {status==='success'&&<><CheckCircle2 size={36} color="#A04471" style={{marginTop:22}}/><h1>Password berhasil dibuat</h1><p>Akun telah diaktifkan. Bila admin dashboard belum dapat diakses, pengelola database perlu menyetujui hak akses admin terlebih dahulu.</p><Link href="/admin" className="button button-dark" style={{width:'100%'}}>Masuk ke dashboard</Link></>}
  </main>;
}
