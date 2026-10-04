import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Titiplen.id — Titip Jadi Lebih Mudah',description:'Kelola pesanan jasa titip, cek invoice, dan pantau pembayaran di Titiplen.id.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="id"><body>{children}</body></html>}
