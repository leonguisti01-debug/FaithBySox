import {NextResponse} from 'next/server';
import {database,checkoutCredentials} from '../../../lib/server';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const input=await request.json();
  const name=String(input.name||'').trim().slice(0,120);
  const email=String(input.email||'').trim().slice(0,254);
  const phone=String(input.phone||'').trim().slice(0,50);
  const address=String(input.address||'').trim().slice(0,500);
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||!phone||!address) return NextResponse.json({error:'Please complete your contact and delivery details.'},{status:400});
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>30)return NextResponse.json({error:'Your bag is empty or too large.'},{status:400});
  const items=input.items.map((x:any)=>({slug:String(x.id||''),colour:String(x.color||''),size:String(x.size||''),qty:Number(x.qty)}));
  if(items.some((x:any)=>!x.slug||!x.colour||!x.size||!Number.isInteger(x.qty)||x.qty<1||x.qty>10))return NextResponse.json({error:'Invalid bag items.'},{status:400});
  const unique=new Set(items.map((x:any)=>`${x.slug}|${x.colour}|${x.size}`));
  if(unique.size!==items.length)return NextResponse.json({error:'Please refresh your bag and try again.'},{status:400});
  const db=database();const {key,mode}=checkoutCredentials();
  const {data:products,error:productError}=await db.from('products').select('id,slug,name,price_cents,active').in('slug',items.map((x:any)=>x.slug));
  if(productError)throw productError;
  const prepared=[] as Array<{variant_id:string;product_name:string;colour:string;size:string;quantity:number;unit_price_cents:number}>;
  for(const item of items){
   const product=products?.find(p=>p.slug===item.slug&&p.active);
   if(!product) return NextResponse.json({error:'A product is no longer available.'},{status:400});
   const {data:variant,error}=await db.from('product_variants').select('id,stock_quantity').eq('product_id',product.id).eq('colour',item.colour).eq('size',item.size).maybeSingle();
   if(error)throw error;
   if(!variant)return NextResponse.json({error:`Variant unavailable for ${product.name} (${item.colour}, ${item.size}).`},{status:409});
   prepared.push({variant_id:variant.id,product_name:product.name,colour:item.colour,size:item.size,quantity:item.qty,unit_price_cents:product.price_cents});
  }
  const coupon=String(input.coupon||'').trim().toUpperCase();
  if(coupon && coupon!=='SOXMAS26')return NextResponse.json({error:'Invalid coupon code.'},{status:400});
  const shirtCount=prepared.reduce((s,x)=>s+x.quantity,0);
  if(coupon && shirtCount<2)return NextResponse.json({error:'SOXMAS26 requires at least two shirts.'},{status:400});
  const subtotal=prepared.reduce((s,x)=>s+x.unit_price_cents*x.quantity,0);
  if(!Number.isSafeInteger(subtotal)||subtotal<200)return NextResponse.json({error:'Invalid order amount.'},{status:400});
  // Flat nationwide delivery: R120, stored and charged in cents.
  const shipping=12000;
  const discount=coupon==='SOXMAS26'?Math.round(subtotal*15/100):0;
  const total=subtotal-discount+shipping;
  const orderId=crypto.randomUUID();
  const {error:orderError}=await db.from('orders').insert({id:orderId,customer_name:name,customer_email:email,customer_phone:phone,delivery_address:{address},subtotal_cents:subtotal,discount_cents:discount,coupon_code:coupon||null,shipping_cents:shipping,total_cents:total,payment_status:'pending',fulfilment_status:'unfulfilled',payment_reference:null,payment_mode:mode});
  if(orderError)throw orderError;
  const {error:itemsError}=await db.from('order_items').insert(prepared.map(x=>({...x,order_id:orderId})));
  if(itemsError){await db.from('orders').delete().eq('id',orderId);throw itemsError;}
  const base='https://www.faithbysox.co.za';
  const yoco=await fetch('https://payments.yoco.com/api/checkouts',{method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':orderId},body:JSON.stringify({amount:total,currency:'ZAR',successUrl:`${base}/checkout/return?order=${orderId}`,cancelUrl:`${base}/checkout?cancelled=1`,failureUrl:`${base}/checkout?failed=1`,metadata:{orderId}}),cache:'no-store'});
  const result=await yoco.json().catch(()=>({}));
  if(!yoco.ok||typeof result.redirectUrl!=='string'||!result.redirectUrl.startsWith('https://')||typeof result.id!=='string'||!/^ch_[a-zA-Z0-9_-]+$/.test(result.id)){
   await db.from('orders').update({payment_status:'checkout_failed'}).eq('id',orderId);
   return NextResponse.json({error:'Yoco could not start payment. Please try again.'},{status:502});
  }
  const reference=result.id;
  const {error:referenceError}=await db.from('orders').update({payment_reference:reference}).eq('id',orderId);
  if(referenceError)throw referenceError;
  return NextResponse.json({redirectUrl:result.redirectUrl});
 }catch(error){console.error('Checkout error',error);return NextResponse.json({error:'Checkout is not configured or temporarily unavailable.'},{status:503});}
}
