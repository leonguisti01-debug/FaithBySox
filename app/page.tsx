"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Menu,X,ShoppingBag,Truck,ShieldCheck,RotateCcw,ArrowRight} from 'lucide-react';
import {Product,defaults,loadProducts,getCart,colorHex} from '../lib/store';
const images=['/faith-black.webp','/faith-white.webp','/faith-cream.webp','/faith-brown.webp'];
export default function Home(){
 const [products,setProducts]=useState<Product[]>([]),[count,setCount]=useState(0),[menu,setMenu]=useState(false);
 useEffect(()=>{const sync=()=>{loadProducts().then(setProducts).catch(console.error);setCount(getCart().reduce((s,i)=>s+i.qty,0))};sync();window.addEventListener('fbs-update',sync);return()=>window.removeEventListener('fbs-update',sync)},[]);
 const featured=products.find(p=>p.id==='faith-over-fear')||products[0];
 return <main className="shell editorial">
  <section className="campaign" aria-label="For His Glory campaign">
   <img className="campaign-image" src="/campaign-hero.webp" alt="FAITH BY SOX. For His Glory collection campaign, featuring a cream Faith Over Fear T-shirt" />
   <button className="hotspot menu-hotspot" aria-label="Open menu" onClick={()=>setMenu(!menu)}>{menu?<X/>:null}</button>
   <a className="hotspot cart-hotspot" href="#bag" aria-label={`Shopping bag, ${count} items`}></a>
   <a className="hotspot shop-hotspot" href="#collection" aria-label="Shop the collection"></a>
   {menu&&<nav className="campaign-menu"><button onClick={()=>setMenu(false)} aria-label="Close menu"><X/></button><a href="#collection" onClick={()=>setMenu(false)}>SHOP THE COLLECTION</a><a href="#purpose" onClick={()=>setMenu(false)}>OUR PURPOSE</a><Link href="/admin">ADMIN</Link></nav>}
  </section>
  <section id="collection" className="editorial-collection">
   <div className="rough-top" aria-hidden="true"/>
   <div className="collection-title"><span/> <h1>THE COLLECTION</h1><span/></div>
   <p className="collection-kicker">COLLECTION 001 · FOR HIS GLORY</p>
   <div className="color-gallery">{images.map((img,i)=><Link key={img} href={'/product/'+(featured?.id||'faith-over-fear')} className="color-card"><img src={img} alt={`Faith Over Fear T-shirt in ${['black','white','cream','brown'][i]}`}/><div className="color-name">{['BLACK','WHITE','CREAM','BROWN'][i]}</div></Link>)}</div>
   <div className="gallery-dots" aria-hidden="true"><b/> <i/> <i/> <i/></div>
   <div className="product-header"><span>DISCOVER THE RANGE</span><h2>MADE TO BE <em>WORN.</em><br/>MADE TO <em>MEAN.</em></h2></div>
   <div className="catalog-grid">{products.filter(p=>p.active).map(p=><Link className="catalog-card" key={p.id} href={'/product/'+p.id}><div className="catalog-photo"><img src={p.image|| (p.id==='glory'?'/glory-back.webp':p.id==='forgiven'?'/forgiven-back.webp':'/faith-cream.webp')} alt={p.name}/></div><div className="catalog-name"><b>{p.name}</b><span>R {p.price.toFixed(2)}</span></div><small>{p.verse} · {p.colors.length} COLOURS</small></Link>)}</div>
   <a className="collection-action" href="#bag">YOUR BAG <ArrowRight size={18}/></a>
  </section>
  <section className="editorial-benefits"><div><Truck/><span>NATIONWIDE<br/>DELIVERY</span></div><div><ShieldCheck/><span>SECURE CHECKOUT<br/>COMING SOON</span></div><div><RotateCcw/><span>RETURNS<br/>POLICY PENDING</span></div></section>
  <section id="purpose" className="editorial-purpose"><p>MORE THAN CLOTHING</p><h2>A DECLARATION<br/>OF FAITH.</h2><span className="underline-stroke"/></section>
  <footer className="editorial-footer"><strong>FAITH <span>BY</span> SOX.</strong><p>FOR HIS GLORY · COLLECTION 001</p><small>© 2026 FAITH BY SOX</small></footer>
  <div id="bag" className="editorial-bag">{count?`${count} ITEM(S) IN YOUR DEMO BAG · CHECKOUT COMING SOON`:'YOUR BAG IS EMPTY · CHECKOUT COMING SOON'}</div>
 </main>
}
