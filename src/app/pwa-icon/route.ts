import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export const runtime='nodejs';
const IMAGE_PATH=join(process.cwd(),'public','brand','titiplen-logo.webp');
const IMAGE_URL='https://titiplen-id.vercel.app/brand/titiplen-logo.webp';

async function loadLogo(){
  try {return await readFile(IMAGE_PATH);}
  catch {
    // Public static assets may be deployed outside the serverless filesystem.
    const image=await fetch(IMAGE_URL);
    if(!image.ok)throw new Error('Official Titiplen logo unavailable');
    return Buffer.from(await image.arrayBuffer());
  }
}
export async function GET(request:Request){
  try {
    const size=new URL(request.url).searchParams.get('size')==='192'?192:512;
    const input=await loadLogo();
    // Maskable safe area: keep the full mascot safely inside the center.
    const contentSize=Math.round(size*.68);
    const icon=await sharp(input).resize({width:contentSize,height:contentSize,fit:'contain'}).png().toBuffer();
    const paddingBefore=Math.floor((size-contentSize)/2);
    const paddingAfter=size-contentSize-paddingBefore;
    const output=await sharp(icon).extend({
      top:paddingBefore,bottom:paddingAfter,left:paddingBefore,right:paddingAfter,
      background:'#FFF1F8'
    }).png({compressionLevel:9}).toBuffer();
    return new Response(new Uint8Array(output),{
      headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=3600, s-maxage=86400'}
    });
  } catch(error) {
    console.error('PWA icon generation failed:',error);
    return new Response('Icon unavailable',{status:503});
  }
}
