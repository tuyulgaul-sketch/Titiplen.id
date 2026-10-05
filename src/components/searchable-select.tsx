'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,ChevronDown,Search,X} from 'lucide-react';

export type SearchableOption={value:string;label:string;searchText?:string;meta?:string};

type Props={
 value:string;
 options:SearchableOption[];
 onChange:(value:string)=>void;
 placeholder?:string;
 searchPlaceholder?:string;
 emptyLabel?:string;
 disabled?:boolean;
 allowClear?:boolean;
 className?:string;
};

export function SearchableSelect({
 value,options,onChange,placeholder='Pilih…',searchPlaceholder='Cari…',
 emptyLabel='Tidak ada hasil',disabled=false,allowClear=true,className=''
}:Props){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const root=useRef<HTMLDivElement>(null);
 const input=useRef<HTMLInputElement>(null);
 const selected=options.find(o=>o.value===value);
 const filtered=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase('id-ID');
  if(!q)return options;
  return options.filter(o=>(o.label+' '+(o.searchText||'')+' '+(o.meta||'')).toLocaleLowerCase('id-ID').includes(q));
 },[options,query]);
 useEffect(()=>{
  const close=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node)){setOpen(false);setQuery('');}};
  document.addEventListener('pointerdown',close);
  return ()=>document.removeEventListener('pointerdown',close);
 },[]);
 useEffect(()=>{if(open)requestAnimationFrame(()=>input.current?.focus());},[open]);
 function choose(next:string){
  onChange(next);setOpen(false);setQuery('');
 }
 return <div ref={root} className={'searchable-select '+(open?'open ':'')+className}>
   <button type="button" className="searchable-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
     <span className={selected?'':'searchable-placeholder'}>{selected?.label||placeholder}</span>
     <span className="searchable-trigger-icons">
       {allowClear&&value&&!disabled&&<span role="button" tabIndex={0} aria-label="Hapus pilihan" className="searchable-clear" onClick={e=>{e.stopPropagation();choose('');}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();choose('');}}}><X size={14}/></span>}
       <ChevronDown size={17}/>
     </span>
   </button>
   {open&&<div className="searchable-popover">
     <div className="searchable-search"><Search size={16}/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder={searchPlaceholder} autoComplete="off" /></div>
     <div className="searchable-options" role="listbox">
       {filtered.length?filtered.slice(0,200).map(o=><button type="button" role="option" aria-selected={o.value===value} key={o.value} className={'searchable-option '+(o.value===value?'selected':'')} onClick={()=>choose(o.value)}>
         <span><strong>{o.label}</strong>{o.meta&&<small>{o.meta}</small>}</span>{o.value===value&&<Check size={15}/>}
       </button>):<div className="searchable-empty">{emptyLabel}</div>}
       {filtered.length>200&&<div className="searchable-limit">Menampilkan 200 hasil pertama. Persempit pencarian.</div>}
     </div>
   </div>}
 </div>;
}
