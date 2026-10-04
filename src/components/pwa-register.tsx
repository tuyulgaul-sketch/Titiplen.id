'use client';
import {useEffect} from 'react';

/** Only public shell assets are cached; NEVER cache private admin pages or Supabase data. */
export function PwaRegister(){
  useEffect(()=>{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js',{scope:'/'})
        .catch(()=>{/* PWA is an enhancement; browsing must still work normally. */});
    }
  },[]);
  return null;
}
