import type {StoreData,OrderItem,Invoice} from './types';
export const idr=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
export const shortDate=(s:string|null|undefined)=>s?new Date(s).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—';
export function normalizePhone(input:string):string|null {
  const digits=input.replace(/\D/g,'');
  const normalized=digits.startsWith('0')?'62'+digits.slice(1):digits;
  return /^62[0-9]{8,13}$/.test(normalized)?'+'+normalized:null;
}
export const numeric=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;
export function lineSales(item:OrderItem):number {
  return item.quantity*(item.cost_unit+item.fee_unit+item.extra_fee_unit)+item.shipping_charge-item.discount;
}
export function lineCost(item:OrderItem):number {
  return item.quantity*item.cost_unit+item.shipping_cost;
}
export const lineProfit=(item:OrderItem)=>lineSales(item)-lineCost(item);
export function invoiceTotal(data:StoreData,invoiceId:string):number {
  const ids=new Set(data.invoice_items.filter(x=>x.invoice_id===invoiceId).map(x=>x.order_item_id));
  return data.order_items.filter(x=>ids.has(x.id)).reduce((sum,x)=>sum+lineSales(x),0);
}
export function paidTotal(data:StoreData,invoiceId:string):number {
  return data.payments.filter(x=>x.invoice_id===invoiceId).reduce((sum,x)=>sum+x.amount,0);
}
export function invoiceBalance(data:StoreData,invoiceId:string):number {
  return Math.max(0,invoiceTotal(data,invoiceId)-paidTotal(data,invoiceId));
}
export function invoiceStatus(data:StoreData,invoiceId:string):'Lunas'|'DP'|'Belum bayar' {
  const total=invoiceTotal(data,invoiceId),paid=paidTotal(data,invoiceId);
  if(total>0&&paid>=total)return 'Lunas';
  if(paid>0)return 'DP';
  return 'Belum bayar';
}
export function getEventFinance(data:StoreData,eventId:string|null) {
  const orderIds=new Set(data.orders.filter(o=>o.event_id===eventId).map(o=>o.id));
  const items=data.order_items.filter(i=>orderIds.has(i.order_id));
  const sales=items.reduce((sum,i)=>sum+lineSales(i),0);
  const cost=items.reduce((sum,i)=>sum+lineCost(i),0);
  const expenses=data.expenses.filter(e=>e.event_id===eventId).reduce((sum,e)=>sum+e.amount,0);
  return {sales,cost,expenses,profit:sales-cost-expenses,count:items.length,margin:sales?(sales-cost-expenses)/sales*100:0};
}
export function getBusinessFinance(data:StoreData) {
  const sales=data.order_items.reduce((sum,i)=>sum+lineSales(i),0);
  const cost=data.order_items.reduce((sum,i)=>sum+lineCost(i),0);
  const expenses=data.expenses.reduce((sum,e)=>sum+e.amount,0);
  const billed=data.invoices.reduce((sum,i)=>sum+invoiceTotal(data,i.id),0);
  const collected=data.payments.reduce((sum,p)=>sum+p.amount,0);
  return {sales,cost,expenses,profit:sales-cost-expenses,margin:sales?(sales-cost-expenses)/sales*100:0,billed,collected,outstanding:Math.max(0,billed-collected)};
}
export function invoiceItems(data:StoreData,invoice:Invoice):OrderItem[] {
  const ids=new Set(data.invoice_items.filter(x=>x.invoice_id===invoice.id).map(x=>x.order_item_id));
  return data.order_items.filter(i=>ids.has(i.id));
}
export const nextInvoiceNumber=(data:StoreData)=>'TPL-'+new Date().getFullYear()+'-'+String(data.invoices.length+1).padStart(5,'0');
