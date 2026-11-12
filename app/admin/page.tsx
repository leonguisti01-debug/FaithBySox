'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Plus,Trash2,Save,LogOut} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';
import {Product,loadProducts} from '../../lib/store';
import AdminOrders from './orders';
import StoreControl from './store-control';
const empty=():Product=>({id:'new-'+Date.now(),name:'NEW DESIGN',verse:'',price:395,description:'',colors:['Black','White','Cream','Brown'],sizes:['S','M','L','XL','2XL','3XL'],stock:{},image:'',active:false,collection:'Faith'});
export default function Admin(){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[allowed,setAllowed]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[items,setItems]=useState<Product[]>([]),[selected,setSelected]=useState(0),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[upload,setUpload]=useState<File|null>(null);
 async function refresh(){const rows=await loadProducts();setItems(rows);setSelected(0)}
 useEffect(()=>{let active=true;(async()=>{if(!supabase){setReady(true);return}const {data:{user:u}}=await supabase.auth.getUser();if(!active)return;setUser(u);if(u){const {data}=await supabase.rpc('is_store_admin');if(active){setAllowed(data===true);if(data===true)await refresh().catch(e=>setSaved(e.message))}}setReady(true)})();return()=>{active=false}},[]);
 async function login(e:React.FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setSaved('');const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error){setSaved(error.message)}else{setUser(data.user);const {data:ok}=await supabase.rpc('is_store_admin');setAllowed(ok===true);if(ok===true)await refresh().catch(e=>setSaved(e.message));else setSaved('This account does not have store admin permission.')}setBusy(false)}
 async function logout(){await supabase?.auth.signOut();setUser(null);setAllowed(false);setPassword('')}
 const p=items[selected];function patch(next:Partial<Product>){setItems(v=>v.map((x,i)=>i===selected?{...x,...next}:x));setSaved('')}
 function add(){setItems(v=>[...v,empty()]);setSelected(items.length);setSaved('')}
 async function save(){if(!supabase||!p)return;setBusy(true);setSaved('');try{
  if(!p.name.trim()||!p.id.trim()||!Number.isFinite(p.price)||p.price<0)throw Error('Enter a valid product name, slug and price.');
  if(!p.colors.length||!p.sizes.length)throw Error('Add at least one colour and size.');
  const {data:existing,error:findError}=await supabase.from('products').select('id').eq('slug',p.id).maybeSingle();if(findError)throw findError;
  let image=p.image;
  if(upload){
   if(upload.size>5_000_000)throw Error('Image must be smaller than 5 MB.');
   if(!upload.type.startsWith('image/'))throw Error('Please select an image.');
   const {data:sessionData}=await supabase.auth.getSession();
   const token=sessionData.session?.access_token;
   if(!token)throw Error('Sign in again to upload photos.');
   const body=new FormData();body.append('image',upload);
   const response=await fetch('/api/admin/upload-image',{method:'POST',headers:{Authorization:`Bearer ${token}`},body});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Photo upload failed.');
   image=result.url;
  }
  const payload={name:p.name.trim(),slug:p.id.trim(),description:p.description,collection_name:p.collection.trim()||'Faith',price_cents:Math.round(p.price*100),images:image?[image]:[],active:p.active};
  let id=existing?.id;
  if(id){const {error}=await supabase.from('products').update(payload).eq('id',id);if(error)throw error}else{const {data,error}=await supabase.from('products').insert(payload).select('id').single();if(error)throw error;id=data.id}
  const {error:delError}=await supabase.from('product_variants').delete().eq('product_id',id);if(delError)throw delError;
  const variants=p.colors.flatMap(colour=>p.sizes.map(size=>({product_id:id,colour,size,stock_quantity:999999})));
  const {error:varError}=await supabase.from('product_variants').insert(variants);if(varError)throw varError;
  setUpload(null);await refresh();setSelected(Math.max(0,items.findIndex(x=>x.id===p.id)));setSaved('SAVED TO DATABASE');
 }catch(e:any){setSaved('ERROR: '+e.message)}finally{setBusy(false)}}
 async function remove(){if(!p||!supabase||!confirm('Permanently delete this product?'))return;setBusy(true);const {error}=await supabase.from('products').delete().eq('slug',p.id);if(error)setSaved(error.message);else{await refresh();setSaved('PRODUCT DELETED')}setBusy(false)}
 if(!ready)return <main className="shell admin"><p className="admin-head">Checking access…</p></main>;
 if(!supabase)return <main className="shell admin"><div className="admin-head">Supabase environment variables are missing. Check Vercel configuration.</div></main>;
 if(!user)return <main className="shell admin"><header className="header"><Link href="/"><ArrowLeft/></Link><b>SOX / SECURE ADMIN</b><span/></header><div className="admin-head"><span className="eyebrow">PRIVATE ACCESS</span><h1>YOUR SHOP.<br/><i>YOUR RULES.</i></h1><p>Sign in to manage FAITH BY SOX.</p></div><form className="admin-form" onSubmit={login}><label>EMAIL<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>PASSWORD<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} className="cta full">{busy?'SIGNING IN…':'SIGN IN'}</button>{saved&&<p className="notice">{saved}</p>}</form></main>;
 if(!allowed)return <main className="shell admin"><div className="admin-head"><h1>ACCESS DENIED</h1><p>This user is not a store administrator.</p><button onClick={logout}>SIGN OUT</button></div></main>;
 return <main className="shell admin"><header className="header"><Link href="/"><ArrowLeft/></Link><b>SOX / ADMIN</b><button title="Sign out" onClick={logout}><LogOut size={20}/></button></header><StoreControl/><AdminOrders/><div className="admin-head"><span className="eyebrow">PRODUCT MANAGEMENT</span><h1>YOUR SHOP.<br/><i>YOUR RULES.</i></h1><p>Manage your shirts, prices, colours, sizes and photos. All products are made to order; no stock counts needed.</p></div><div className="admin-toolbar"><strong>{items.length} PRODUCTS</strong><button onClick={add}><Plus size={16}/> ADD PRODUCT</button></div><div className="admin-list">{items.map((item,i)=><button key={item.id} onClick={()=>{setSelected(i);setUpload(null);setSaved('')}} className={i===selected?'active':''}>{item.name}<span>R {item.price}</span></button>)}</div>{p&&<div className="admin-form"><label>PRODUCT NAME<input value={p.name} onChange={e=>patch({name:e.target.value})}/></label><label>PRODUCT SLUG (URL)<input value={p.id} disabled={!p.id.startsWith('new-')} onChange={e=>patch({id:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})}/></label><label>PRICE (ZAR)<input type="number" min="0" step="0.01" value={p.price} onChange={e=>patch({price:Number(e.target.value)})}/></label><label>DESCRIPTION<textarea value={p.description} onChange={e=>patch({description:e.target.value})}/></label><label>RANGE / COLLECTION<input list="available-ranges" value={p.collection} onChange={e=>patch({collection:e.target.value})}/><datalist id="available-ranges"><option value="Faith"/><option value="Breeze"/>{[...new Set(items.map(x=>x.collection).filter(Boolean))].map(name=><option key={name} value={name}/>)}</datalist></label><p className="fineprint">Type a new range name to create a new range automatically when you save this product.</p><label>COLOURS — COMMA SEPARATED<input value={p.colors.join(', ')} onChange={e=>patch({colors:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label><label>SIZES — COMMA SEPARATED<input value={p.sizes.join(', ')} onChange={e=>patch({sizes:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label><label>PRODUCT PHOTO<input type="file" accept="image/*" onChange={e=>setUpload(e.target.files?.[0]||null)}/></label>{p.image&&<img className="admin-preview" src={p.image} alt="Preview"/>}<label className="check"><input type="checkbox" checked={p.active} onChange={e=>patch({active:e.target.checked})}/> SHOW PRODUCT IN SHOP</label><button disabled={busy} className="cta full" onClick={save}>{busy?'SAVING…':'SAVE CHANGES'} <Save size={18}/></button>{saved&&<p className="notice">{saved}</p>}<button disabled={busy} className="danger" onClick={remove}><Trash2 size={16}/> DELETE PRODUCT</button></div>}<div className="admin-warning">LIVE STORE: Verify payment in Yoco before printing or dispatching. Product updates save to Supabase.</div></main>
}
