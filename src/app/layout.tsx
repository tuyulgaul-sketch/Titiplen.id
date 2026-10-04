import type {Metadata,Viewport} from 'next';
import {PwaRegister} from '@/components/pwa-register';
import './globals.css';

export const metadata:Metadata={
 title:'Titiplen.id — Titip Jadi Lebih Mudah',
 description:'Kelola pesanan jasa titip, cek invoice, dan pantau pembayaran di Titiplen.id.',
 applicationName:'Titiplen.id',
 icons:{icon:[{url:'/brand/titiplen-logo.webp',type:'image/webp',sizes:'any'}],apple:'/pwa-icon?size=192'},
 appleWebApp:{capable:true,title:'Titiplen',statusBarStyle:'default'},
 formatDetection:{telephone:false}
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#7D2F55'};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="id"><body><PwaRegister/>{children}</body></html>;
}
