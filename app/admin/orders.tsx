 'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
type Order={id:string;created_at:string;customer_name:string;customer_email:string;customer_phone:string;delivery_address:any;total_cents:number;shipping_cents:number;fulfilment_status:string;order_items:Array<{product_name:string;colour:string;size:string;quantity:number}>};
const statuses=['unfulfilled','printing','ready','dispatched','completed'];
export default function AdminOrders(){
 const [orders,setOrders]=useState<Order[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function request(method:'GET'|'PATCH',body?:any){
  const {data:{session}}=await supabase!.auth.getSession();
  if(!session)throw Error('Please sign in again.');
  const res=await fetch('/api/admin/orders',{method,headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const result=await res.json();if(!res.ok)throw Error(result.error||'Request failed');return result;
 }
 async function refresh(){setBusy(true);try{setOrders((await request('GET')).orders);setError('')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{refresh()},[]);
 async function change(id:string,status:string){setBusy(true);try{await request('PATCH',{id,status});await refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="admin-form" style={{marginBottom:32}}><h2>PAID ORDERS / PRINT QUEUE</h2><p>Only Yoco-confirmed paid orders appear here. Refresh to check for new orders.</p><button className="cta full" disabled={busy} onClick={refresh}>REFRESH PAID ORDERS</button>{error&&<p className="notice">{error}</p>}{!busy&&orders.length===0&&<p>No paid orders yet.</p>}{orders.map(o=><article key={o.id} style={{padding:'18px 0',borderBottom:'1px solid #666'}}><strong>#{o.id.slice(0,8).toUpperCase()} — R {(o.total_cents/100).toFixed(2)}</strong><p>{new Date(o.created_at).toLocaleString('en-ZA')} | {o.customer_name}</p><p>{o.customer_email} | {o.customer_phone}</p><p>{typeof o.delivery_address==='object'?o.delivery_address?.address: String(o.delivery_address||'')}</p>{(o.order_items||[]).map((item,i)=><p key={i}>{item.quantity} × {item.product_name} — {item.colour} / {item.size}</p>)}<label>PRODUCTION STATUS<select value={o.fulfilment_status||'unfulfilled'} disabled={busy} onChange={e=>change(o.id,e.target.value)}>{statuses.map(s=><option value={s} key={s}>{s==='unfulfilled'?'Awaiting printing':s.toUpperCase()}</option>)}</select></label></article>)}</section>
}
