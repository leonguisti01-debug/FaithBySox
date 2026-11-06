"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {X,ArrowRight} from 'lucide-react';
import {Product,loadProducts,getCart} from '../lib/store';

const gallery=['/faith-black.webp','/faith-white.webp','/faith-cream.webp','/faith-brown.webp'];
export default function Home(){
 const [products,setProducts]=useState<Product[]>([]);
 const [count,setCount]=useState(0);
 const [menu,setMenu]=useState(false);
 const [range,setRange]=useState('All');
 useEffect(()=>{
  const sync=()=>{loadProducts().then(setProducts).catch(console.error);setCount(getCart().reduce((sum,item)=>sum+item.qty,0));};
  sync();window.addEventListener('fbs-update',sync);
  return()=>window.removeEventListener('fbs-update',sync);
 },[]);
 const active=products.filter(p=>p.active);
 const ranges=[...new Set(['Faith','Breeze',...active.map(p=>p.collection||'Faith')])];
 const shown=range==='All'?active:active.filter(p=>(p.collection||'Faith').toLowerCase()===range.toLowerCase());
 const featured=products.find(p=>p.id==='faith-over-fear')||products[0];
 const chooseRange=(name:string)=>{setRange(name);document.getElementById('shop-products')?.scrollIntoView({behavior:'smooth'});};
 return <main className="shell exact-mobile">
  <header className="approved-panel approved-header">
   <img src="/approved-header.webp" alt="FAITH BY SOX original logo and navigation"/>
   <button className="hit header-menu-hit" aria-label="Open navigation" onClick={()=>setMenu(true)}/>
   <Link className="hit header-bag-hit" href="/checkout" aria-label={`Shopping bag, ${count} items`}/>
   {menu&&<nav className="exact-menu" aria-label="Main navigation"><button onClick={()=>setMenu(false)} aria-label="Close navigation"><X/></button><a href="#ranges" onClick={()=>setMenu(false)}>OUR RANGES</a><a href="#featured" onClick={()=>setMenu(false)}>FEATURED STYLES</a><a href="#shop-products" onClick={()=>setMenu(false)}>SHOP ALL</a><Link href="/checkout">YOUR BAG ({count})</Link><Link href="/admin">ADMIN</Link></nav>}
  </header>
  <section className="approved-panel approved-hero" aria-label="More than clothing. A declaration of faith. Wear what you believe.">
   <img src="/approved-hero.webp" alt="More than clothing. A declaration of faith. Wear what you believe. Shop the ranges."/>
   <a className="hit hero-cta-hit" href="#ranges" aria-label="Shop the ranges"/>
  </section>
  <section id="ranges" className="approved-panel approved-ranges" aria-label="Our ranges: Breeze and Faith">
   <img src="/approved-ranges.webp" alt="Our ranges: The Breeze Range, The Faith Range, and more ranges coming soon"/>
   <button className="hit range-breeze-hit" aria-label="Shop the Breeze range" onClick={()=>chooseRange('Breeze')}/>
   <button className="hit range-faith-hit" aria-label="Shop the Faith range" onClick={()=>chooseRange('Faith')}/>
  </section>
  <section id="featured" className="approved-panel approved-featured" aria-label="Featured styles: Faith Over Fear shirts">
   <img src="/approved-featured.webp" alt="Featured styles: Faith Over Fear in black, white, cream and brown"/>
   {gallery.map((img,i)=><Link key={img} className="hit featured-hit" style={{left:`${[2,26.5,51.5,76][i]}%`}} href={'/product/'+(featured?.id||'faith-over-fear')} aria-label={`View Faith Over Fear ${['black','white','cream','brown'][i]} shirt`}/>)}
  </section>
  <section className="approved-panel approved-benefits"><img src="/approved-benefits.webp" alt="Nationwide delivery, secure checkout and easy returns"/></section>
  <section className="approved-panel approved-purpose"><img src="/approved-purpose.webp" alt="Faith-inspired apparel for everyday life"/></section>
  <section id="shop-products" className="exact-shop">
   <p className="exact-kicker">EXPLORE THE COLLECTION</p><h2>SHOP THE RANGES</h2>
   <div className="exact-filter"><button className={range==='All'?'active':''} onClick={()=>setRange('All')}>ALL</button>{ranges.map(name=><button key={name} className={range===name?'active':''} onClick={()=>setRange(name)}>{name.toUpperCase()}</button>)}</div>
   <div className="exact-products">{shown.map(p=><Link key={p.id} href={'/product/'+p.id} className="exact-product"><img src={p.image||(p.id==='glory'?'/glory-back.webp':p.id==='forgiven'?'/forgiven-back.webp':'/faith-cream.webp')} alt={p.name}/><strong>{p.name}</strong><span>R {p.price.toFixed(2)}</span></Link>)}</div>
   {!shown.length&&<p className="exact-empty">THIS RANGE IS COMING SOON.</p>}
   {ranges.filter(name=>!['Faith','Breeze'].includes(name)).length>0&&<div className="exact-new-ranges"><h3>MORE RANGES</h3>{ranges.filter(name=>!['Faith','Breeze'].includes(name)).map(name=><button key={name} onClick={()=>chooseRange(name)}>{name.toUpperCase()} <ArrowRight size={17}/></button>)}</div>}
  </section>
  <footer className="exact-footer"><strong>FAITH <span>BY</span> SOX.</strong><p>MORE THAN CLOTHING. A DECLARATION OF FAITH.</p><Link href="/checkout">VIEW YOUR BAG ({count})</Link></footer>
 </main>;
}
