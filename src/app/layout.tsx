import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Titiplen.id — Titip Jadi Lebih Mudah',description:'Kelola pesanan jasa titip, cek invoice, dan pantau pembayaran di Titiplen.id.',icons:{icon:[{url:'/brand/titiplen-logo.webp',type:'image/webp',sizes:'any'}],apple:'/brand/titiplen-logo.webp'}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="id"><body>{children}</body></html>}
