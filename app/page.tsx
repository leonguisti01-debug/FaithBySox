"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {X} from 'lucide-react';
import {Product,loadProducts,getCart} from '../lib/store';
const gallery=['/faith-black.webp','/faith-white.webp','/faith-cream.webp','/faith-brown.webp'];
export default function Home(){
 const [products,setProducts]=useState<Product[]>([]),[count,setCount]=useState(0),[menu,setMenu]=useState(false),[range,setRange]=useState('All'),[loading,setLoading]=useState(true);
 useEffect(()=>{const sync=()=>{loadProducts().then(setProducts).catch(console.error).finally(()=>setLoading(false));setCount(getCart().reduce((s,x)=>s+x.qty,0));};sync();window.addEventListener('fbs-update',sync);return()=>window.removeEventListener('fbs-update',sync)},[]);
 const active=products.filter(p=>p.active),ranges=[...new Set(active.map(p=>p.collection||'Faith'))];
 const shown=range==='All'?active:active.filter(p=>(p.collection||'Faith').toLowerCase()===range.toLowerCase());
 const featured=products.find(p=>p.id==='faith-over-fear')||products[0];
 return <main className="shell exact-mobile">
  <section className="campaign-front" aria-label="FAITH BY SOX — For His Glory">
   <img src="/campaign-hero.webp" alt="FAITH BY SOX. Collection 001 — For His Glory. Faith Over Fear shirt. Shop the collection."/>
   <button className="campaign-menu-hit" aria-label="Open menu" onClick={()=>setMenu(true)}/>
   <Link className="campaign-cart-hit" href="/checkout" aria-label={`Shopping bag, ${count} items`}/>
   <a className="campaign-shop-hit" href="#shop-products" aria-label="Shop the collection"/>
   {menu&&<nav className="campaign-nav" aria-label="Main navigation"><button onClick={()=>setMenu(false)} aria-label="Close menu"><X/></button><a href="#collection" onClick={()=>setMenu(false)}>THE COLLECTION</a><a href="#shop-products" onClick={()=>setMenu(false)}>SHOP SHIRTS</a><Link href="/checkout">YOUR BAG ({count})</Link><Link href="/admin">MANAGE PRODUCTS</Link></nav>}
  </section>
  <section id="collection" className="reference-collection"><div className="reference-heading"><span/>THE COLLECTION<span/></div>
   <div className="reference-gallery">{gallery.map((img,i)=><Link key={img} href={'/product/'+(featured?.id||'faith-over-fear')} aria-label={`View Faith Over Fear in ${['black','white','cream','brown'][i]}`}><img src={img} alt={`Faith Over Fear ${['black','white','cream','brown'][i]} shirt`}/></Link>)}</div>
   <div className="reference-dots"><b/><i/><i/><i/></div>
  </section>
  <section className="approved-panel approved-benefits"><img src="/approved-benefits.webp" alt="Nationwide delivery, secure checkout, easy returns"/></section>
  <section className="reference-purpose"><p>MORE THAN CLOTHING</p><h2>A DECLARATION OF FAITH.</h2><span/></section>
  <section id="shop-products" className="exact-shop"><p className="exact-kicker">COLLECTION 001</p><h2>SHOP THE SHIRTS</h2>
   <div className="exact-filter"><button className={range==='All'?'active':''} onClick={()=>setRange('All')}>ALL</button>{ranges.map(name=><button key={name} className={range===name?'active':''} onClick={()=>setRange(name)}>{name.toUpperCase()}</button>)}</div>
   <div className="exact-products">{shown.map(p=><Link key={p.id} href={'/product/'+p.id} className="exact-product"><img src={p.image||(p.id==='glory'?'/glory-back.webp':p.id==='forgiven'?'/forgiven-back.webp':'/faith-cream.webp')} alt={p.name}/><strong>{p.name}</strong><span>R {p.price.toFixed(2)}</span></Link>)}</div>
   {!shown.length&&<p className="exact-empty">{loading?'LOADING SHIRTS…':'NO SHIRTS AVAILABLE YET. ADD THEM IN ADMIN.'}</p>}
  </section>
  <footer className="exact-footer"><strong>FAITH <span>BY</span> SOX.</strong><p>FAITH. IDENTITY. PURPOSE. WORN BOLDLY.</p><Link href="/checkout">YOUR BAG ({count})</Link><Link href="/admin">STORE ADMIN</Link></footer>
 </main>;
}
