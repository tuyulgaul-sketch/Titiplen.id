import { ImageResponse } from 'next/og';
import { createElement } from 'react';

export const runtime='nodejs';
// Self-hosted brand image is public (no sensitive data or external account keys).
const BRAND_IMAGE='https://titiplen-id.vercel.app/brand/titiplen-logo.webp';
export async function GET(request:Request){
  const size=new URL(request.url).searchParams.get('size')==='192'?192:512;
  const logo=await fetch(BRAND_IMAGE,{next:{revalidate:86400}});
  if(!logo.ok)return new Response('Icon unavailable',{status:503});
  const bytes=Buffer.from(await logo.arrayBuffer()).toString('base64');
  const img=createElement('img',{
    src:'data:image/webp;base64,'+bytes,
    alt:'Titiplen.id',
    width:Math.round(size*.72),
    height:Math.round(size*.72),
    style:{objectFit:'contain',display:'block'}
  });
  const root=createElement('div',{
    style:{height:'100%',width:'100%',backgroundColor:'#FFF1F8',
      display:'flex',justifyContent:'center',alignItems:'center'}
  },img);
  return new ImageResponse(root,{width:size,height:size,
    headers:{'Cache-Control':'public, max-age=3600, s-maxage=86400'}});
}
