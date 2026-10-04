'use client';
import {useEffect,useState} from 'react';
import {Download,Share2,Smartphone,CheckCircle2} from 'lucide-react';

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function PwaInstall(){
 const [installEvent,setInstallEvent]=useState<InstallEvent|null>(null);
 const [standalone,setStandalone]=useState(false);
 const [iphone,setIphone]=useState(false);
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  const appInstalled=()=>{setStandalone(true);setInstallEvent(null);};
  const before=(e:Event)=>{e.preventDefault();setInstallEvent(e as InstallEvent);};
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  setIphone(ios);
  setStandalone(window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
  window.addEventListener('beforeinstallprompt',before);
  window.addEventListener('appinstalled',appInstalled);
  return ()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',appInstalled);};
 },[]);
 if(standalone)return null;
 async function install(){
  if(!installEvent){setOpen(v=>!v);return;}
  await installEvent.prompt();
  try{const decision=await installEvent.userChoice;if(decision.outcome==='accepted')setInstallEvent(null);}catch{/* browser controls install prompt */}
 }
 return <div className="pwa-install">
   <div className="pwa-install-left"><span className="pwa-install-icon"><Smartphone size={20}/></span>
     <div><strong>Pasang Titiplen di HP</strong><small>Buka seperti aplikasi, tanpa perlu App Store.</small></div>
   </div>
   <button type="button" onClick={()=>void install()} className="pwa-install-action"><Download size={15}/>{installEvent?'Install aplikasi':'Cara pasang'}</button>
   {open&&<p className="pwa-install-hint">{iphone?
     <><Share2 size={15}/> Di Safari, tekan tombol <strong>Bagikan / Share</strong>, pilih <strong>Add to Home Screen / Tambah ke Layar Utama</strong>, lalu tekan <strong>Add</strong>.</>:
     <><CheckCircle2 size={15}/> Di Chrome atau Edge, buka menu <strong>⋮</strong> lalu pilih <strong>Install app / Tambahkan ke Layar Utama</strong>. Pastikan menggunakan browser utama, bukan browser di dalam WhatsApp.</>}
   </p>}
 </div>;
}
