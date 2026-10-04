import Link from 'next/link';
type Props={compact?:boolean;inverted?:boolean;className?:string};
export function BrandMark({compact=false,inverted=false,className=''}:Props){
  return <Link href="/" className={['brand-brand','brand-with-mascot',compact?'brand-compact':'',inverted?'brand-inverted':'',className].filter(Boolean).join(' ')}>
    <img src="/brand/titiplen-logo.webp" width={compact?56:60} height={compact?56:60} className="brand-mascot" alt="Maskot resmi Titiplen.id — jastip" draggable={false}/>
    <span className="brand-word">titiplen<span className="brand-dot">.id</span></span>
  </Link>;
}
