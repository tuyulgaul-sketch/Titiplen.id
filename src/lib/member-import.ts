import {normalizePhone} from '@/lib/finance';

export type MemberImportRow={
 phone:string;
 name:string;
 saved_name:string;
 generated:boolean;
 rowNumber:number;
};
export type MemberImportPreview={
 rows:MemberImportRow[];
 issues:{row:number;message:string}[];
 generatedCount:number;
 duplicateCount:number;
 sourceRows:number;
};
function normalizeHeader(s:string){
 return s.toLowerCase().normalize('NFKC').replace(/[\s_.:\/()-]+/g,' ').trim();
}
function sourcePhoneName(name:string,phone:string):boolean{
 const norm=normalizePhone(name);
 return norm===phone || /^[+\d\s\-().]{9,}$/.test(name.trim());
}
export function parseMemberRows(matrix:string[][]):MemberImportPreview{
 const result:MemberImportPreview={rows:[],issues:[],generatedCount:0,duplicateCount:0,sourceRows:0};
 if(matrix.length===0)throw new Error('Spreadsheet tidak berisi data.');
 const knownPhone=['phone number','nomor hp','no hp','nomor whatsapp','no whatsapp','whatsapp','phone','nomor telepon','formatted phone'];
 const knownName=['nama member','nama customer','nama','name','customer name','saved name','contact name','nama kontak'];
 let headerRow=-1,phoneCol=-1,nameCol=-1,savedCol=-1;
 for(let r=0;r<Math.min(matrix.length,12);r++){
  const headers=matrix[r].map(normalizeHeader);
  const phone=knownPhone.map(x=>headers.indexOf(x)).find(x=>x>=0)??-1;
  const name=knownName.map(x=>headers.indexOf(x)).find(x=>x>=0)??-1;
  if(phone>=0&&name>=0){
   headerRow=r;phoneCol=phone;nameCol=name;savedCol=headers.indexOf('saved name');
   break;
  }
 }
 if(headerRow<0)throw new Error('Header Excel tidak dikenali. Gunakan kolom "phone number" dan "saved name", atau "Nomor HP" dan "Nama".');
 const seen=new Set<string>();
 for(let idx=headerRow+1;idx<matrix.length;idx++){
  const values=matrix[idx].map(s=>String(s??'').trim());
  if(values.every(x=>!x))continue;
  result.sourceRows++;
  const phone=normalizePhone(values[phoneCol]||'');
  if(!phone){result.issues.push({row:idx+1,message:'Nomor HP tidak valid'});continue;}
  if(seen.has(phone)){result.duplicateCount++;result.issues.push({row:idx+1,message:'Nomor HP duplikat dalam file'});continue;}
  seen.add(phone);
  const inputName=(values[nameCol]||'').slice(0,120);
  const generated=!inputName||inputName.length<2||sourcePhoneName(inputName,phone);
  const name=generated?'Member '+phone.slice(-4):inputName;
  const saved_name=(savedCol>=0?values[savedCol]:inputName).slice(0,120);
  if(name.length<2||name.length>120){result.issues.push({row:idx+1,message:'Nama tidak valid'});continue;}
  if(generated)result.generatedCount++;
  result.rows.push({phone,name,saved_name,generated,rowNumber:idx+1});
 }
 if(result.sourceRows>5000)throw new Error('Batas upload 5.000 member per file. Pisahkan Excel menjadi beberapa file.');
 return result;
}
const parserError=(xml:Document)=>xml.querySelector('parsererror')!==null;
async function xlsxMatrix(file:File):Promise<string[][]>{
 const JSZip=(await import('jszip')).default;
 const zip=await JSZip.loadAsync(file);
 const workbook=zip.file('xl/workbook.xml');
 if(!workbook)throw new Error('File ini bukan workbook Excel yang valid.');
 const workbookXml=new DOMParser().parseFromString(await workbook.async('string'),'application/xml');
 if(parserError(workbookXml))throw new Error('Struktur workbook Excel rusak.');
 const sheet=workbookXml.getElementsByTagName('sheet')[0];
 if(!sheet)throw new Error('Excel tidak berisi worksheet.');
 const relId=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
 let target='xl/worksheets/sheet1.xml';
 const relXml=zip.file('xl/_rels/workbook.xml.rels');
 if(relId&&relXml){
  const doc=new DOMParser().parseFromString(await relXml.async('string'),'application/xml');
  const rel=[...doc.getElementsByTagName('Relationship')].find(x=>x.getAttribute('Id')===relId);
  const location=rel?.getAttribute('Target');
  if(location){
   target=location.startsWith('/')?location.replace(/^\/+/,''):location.startsWith('xl/')?location:'xl/'+location.replace(/^(\.\.\/)+/,'');
  }
 }
 const sheetData=zip.file(target);
 if(!sheetData)throw new Error('Worksheet pertama tidak ditemukan.');
 const content=await sheetData.async('string');
 if(content.length>7_000_000)throw new Error('Worksheet terlalu besar.');
 const xml=new DOMParser().parseFromString(content,'application/xml');
 if(parserError(xml))throw new Error('XML worksheet tidak valid.');
 const sharedStrings:string[]=[];
 const sharedFile=zip.file('xl/sharedStrings.xml');
 if(sharedFile){
  const strings=await sharedFile.async('string');
  if(strings.length>7_000_000)throw new Error('Tabel string Excel terlalu besar.');
  const doc=new DOMParser().parseFromString(strings,'application/xml');
  if(parserError(doc))throw new Error('XML string Excel tidak valid.');
  for(const node of [...doc.getElementsByTagName('si')]){
   sharedStrings.push([...node.getElementsByTagName('t')].map(n=>n.textContent||'').join(''));
  }
 }
 const rows:string[][]=[];
 const table=xml.getElementsByTagName('sheetData')[0];
 if(!table)throw new Error('Data worksheet tidak ditemukan.');
 for(const row of [...table.getElementsByTagName('row')]){
  const values:string[]=[];
  for(const cell of [...row.getElementsByTagName('c')]){
   const address=cell.getAttribute('r')||'A';
   const letters=address.match(/^[A-Z]+/)?.[0]||'A';
   let col=0;
   for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;
   if(col>30)continue;
   const ty=cell.getAttribute('t')||'';
   const v=cell.getElementsByTagName('v')[0]?.textContent||'';
   let value='';
   if(ty==='s')value=sharedStrings[Number(v)]||'';
   else if(ty==='inlineStr')value=[...cell.getElementsByTagName('t')].map(x=>x.textContent||'').join('');
   else if(ty==='b')value=v==='1'?'TRUE':'FALSE';
   else value=v;
   values[col-1]=value.trim();
  }
  rows.push(values);
 }
 return rows;
}
function csvMatrix(raw:string):string[][]{
 const s=raw.replace(/^\uFEFF/,'');
 const head=s.split(/\r?\n/,1)[0];
 const delimiter=(head.match(/;/g)||[]).length>(head.match(/,/g)||[]).length?';':',';
 const matrix:string[][]=[],row:string[]=[];
 let inQuotes=false,part='';
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(c==='"'){
   if(inQuotes&&s[i+1]==='"'){part+='"';i++;}
   else inQuotes=!inQuotes;
  }else if(c===delimiter&&!inQuotes){row.push(part);part='';}
  else if((c==='\r'||c==='\n')&&!inQuotes){
   row.push(part);matrix.push([...row]);row.length=0;part='';
   if(c==='\r'&&s[i+1]==='\n')i++;
  }else part+=c;
 }
 if(inQuotes)throw new Error('Format kutip CSV tidak lengkap.');
 if(row.length||part){row.push(part);matrix.push([...row]);}
 return matrix;
}
export async function readMemberFile(file:File):Promise<MemberImportPreview>{
 if(file.size>5_000_000)throw new Error('Maksimal file 5 MB.');
 const lower=file.name.toLowerCase();
 if(lower.endsWith('.xlsx'))return parseMemberRows(await xlsxMatrix(file));
 if(lower.endsWith('.csv'))return parseMemberRows(csvMatrix(await file.text()));
 throw new Error('Pilih file Excel .xlsx atau CSV .csv.');
}
