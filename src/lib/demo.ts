import type {StoreData,StoreTable} from './types';
const KEY='titiplen.demo.v1';
const seed:StoreData={
 customers:[{id:'c1',name:'Anita Putri',phone_e164:'+6281234567890'},{id:'c2',name:'Rani Maharani',phone_e164:'+6289876543210'},{id:'c3',name:'Dina Wulandari',phone_e164:'+6287788990011'}],
 events:[{id:'e1',name:'Beauty Expo Jakarta',event_date:'2026-10-01',status:'Aktif'},{id:'e2',name:'Kidswear Pop-up',event_date:'2026-10-03',status:'Aktif'},{id:'e3',name:'Weekend Market',event_date:'2026-09-20',status:'Selesai'}],
 orders:[{id:'o1',customer_id:'c1',event_id:'e1',created_at:'2026-10-01T10:20:00Z',notes:null},{id:'o2',customer_id:'c2',event_id:'e2',created_at:'2026-10-02T10:20:00Z',notes:null},{id:'o3',customer_id:'c3',event_id:'e3',created_at:'2026-09-20T10:20:00Z',notes:null},{id:'o4',customer_id:'c1',event_id:'e2',created_at:'2026-10-03T10:20:00Z',notes:null}],
 order_items:[
 {id:'i1',order_id:'o1',brand:'Somethinc',product_name:'Cushion Copy Paste',variant:'N20',quantity:2,cost_unit:90000,fee_unit:15000,extra_fee_unit:0,shipping_charge:5000,shipping_cost:5000,discount:0},
 {id:'i2',order_id:'o1',brand:'Skintific',product_name:'Mugwort Clay Mask',variant:'55 gram',quantity:1,cost_unit:74000,fee_unit:12000,extra_fee_unit:0,shipping_charge:0,shipping_cost:0,discount:0},
 {id:'i3',order_id:'o2',brand:'Little Planet',product_name:'Cotton Lounge Set',variant:'4Y / Beige',quantity:2,cost_unit:85000,fee_unit:15000,extra_fee_unit:0,shipping_charge:7000,shipping_cost:7000,discount:0},
 {id:'i4',order_id:'o3',brand:'Heimish',product_name:'Cleansing Balm',variant:'120 ml',quantity:1,cost_unit:125000,fee_unit:10000,extra_fee_unit:0,shipping_charge:0,shipping_cost:0,discount:0},
 {id:'i5',order_id:'o4',brand:'Mothercare',product_name:'Baby Jumper',variant:'Size M',quantity:1,cost_unit:110000,fee_unit:20000,extra_fee_unit:5000,shipping_charge:0,shipping_cost:0,discount:0}
 ],
 invoices:[{id:'v1',customer_id:'c1',invoice_number:'TPL-2026-00001',created_at:'2026-10-01T11:00:00Z',due_date:'2026-10-15',notes:null},{id:'v2',customer_id:'c2',invoice_number:'TPL-2026-00002',created_at:'2026-10-02T11:00:00Z',due_date:'2026-10-15',notes:null},{id:'v3',customer_id:'c3',invoice_number:'TPL-2026-00003',created_at:'2026-09-20T11:00:00Z',due_date:null,notes:null}],
 invoice_items:[{id:'vi1',invoice_id:'v1',order_item_id:'i1'},{id:'vi2',invoice_id:'v1',order_item_id:'i2'},{id:'vi3',invoice_id:'v2',order_item_id:'i3'},{id:'vi4',invoice_id:'v3',order_item_id:'i4'}],
 payments:[{id:'p1',invoice_id:'v2',amount:100000,paid_at:'2026-10-03T09:00:00Z',reference:'QRIS-001',method:'QRIS'},{id:'p2',invoice_id:'v3',amount:135000,paid_at:'2026-09-20T14:00:00Z',reference:'QRIS-002',method:'QRIS'}],
 expenses:[{id:'x1',event_id:'e1',category:'Transportasi',description:'Parkir dan bensin',amount:50000,spent_at:'2026-10-01'},{id:'x2',event_id:'e2',category:'Tiket',description:'Tiket masuk event',amount:65000,spent_at:'2026-10-02'},{id:'x3',event_id:null,category:'Operasional umum',description:'Biaya layanan bulanan',amount:25000,spent_at:'2026-10-03'}],
 settings:[{id:1,whatsapp_number:'6281234567890',qris_image_url:'',business_name:'Titiplen.id'}]
};
export function readDemo():StoreData {
  if(typeof window==='undefined')return seed;
  try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw) as StoreData:structuredClone(seed)}catch{return structuredClone(seed)}
}
export function insertDemo<T extends StoreTable>(table:T,payload:Record<string,unknown>):StoreData[T][number]{
  const data=readDemo();const value={...payload,id:table==='settings'?1:crypto.randomUUID(),created_at:new Date().toISOString()};
  (data[table] as Record<string,unknown>[]).push(value);
  localStorage.setItem(KEY,JSON.stringify(data));
  return value as StoreData[T][number];
}
export function updateSettingsDemo(values:Record<string,unknown>) {
 const data=readDemo();data.settings=[{...data.settings[0],...values}];localStorage.setItem(KEY,JSON.stringify(data));
}
export function resetDemo(){localStorage.removeItem(KEY)}

/** Update one demo-only purchase record without mutating billed financial fields. */
export function updateItemPurchaseDemo(itemId:string){
  const data=readDemo();
  const item=data.order_items.find(i=>i.id===itemId);
  if(!item)throw new Error('Barang tidak ditemukan');
  if(item.purchase_status!=='planned')throw new Error('Barang ini sudah berstatus dibeli');
  if(data.invoice_items.some(x=>x.order_item_id===itemId))throw new Error('Barang tertagih tidak dapat diubah');
  item.purchase_status='purchased';item.purchased_at=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(data));
}

/** Simulate a safe batch import in the browser demo, keyed on E.164 phone. */
export function upsertWagMembersDemo(members:{phone:string;name:string;saved_name?:string}[],overwriteNames:boolean){
 const data=readDemo();
 const stats={added:0,renamed:0,unchanged:0,processed:members.length};
 for(const member of members){
  const customer=data.customers.find(c=>c.phone_e164===member.phone);
  if(customer){
   if(overwriteNames && customer.name!==member.name){
    customer.name=member.name;customer.name_changed_at=new Date().toISOString();
    stats.renamed++;
   }else stats.unchanged++;
   customer.is_wag_member=true;customer.wag_saved_name=member.saved_name||customer.wag_saved_name||null;
   customer.wag_last_imported_at=new Date().toISOString();
  }else{
   data.customers.push({
    id:crypto.randomUUID(),name:member.name,phone_e164:member.phone,
    is_wag_member:true,wag_saved_name:member.saved_name||null,
    wag_last_imported_at:new Date().toISOString(),created_at:new Date().toISOString()
   });
   stats.added++;
  }
 }
 localStorage.setItem(KEY,JSON.stringify(data));
 return stats;
}
export function renameCustomerDemo(id:string,name:string){
 const data=readDemo();
 const customer=data.customers.find(c=>c.id===id);
 if(!customer)throw new Error('Member tidak ditemukan');
 customer.name=name;customer.name_changed_at=new Date().toISOString();
 localStorage.setItem(KEY,JSON.stringify(data));
}
