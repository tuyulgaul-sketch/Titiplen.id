import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id:'/admin/field',
    name:'Titiplen.id — Jurnal Belanja Jastip',
    short_name:'Titiplen',
    description:'Catat barang dan modal langsung saat belanja di event, cek rekap, lalu kelola invoice Titiplen.id.',
    start_url:'/admin/field',
    scope:'/',
    display:'standalone',
    background_color:'#FFF7FA',
    theme_color:'#7D2F55',
    orientation:'portrait-primary',
    categories:['business','shopping','productivity'],
    icons:[
      {src:'/pwa-icon?size=192',sizes:'192x192',type:'image/png',purpose:'any'},
      {src:'/pwa-icon?size=512',sizes:'512x512',type:'image/png',purpose:'any maskable'}
    ]
  };
}
