"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Menu,X,ShoppingBag,Truck,ShieldCheck,ArrowRight} from 'lucide-react';
import {Product,loadProducts,getCart} from '../lib/store';

const canonicalRange=(name:string)=>name==='FOR HIS GLORY'?'Faith':(name||'Faith').trim();
export default function Home(){
 const [products,setProducts]=useState<Product[]>([]);
 const [count,setCount]=useState(0);
 const [menu,setMenu]=useState(false);
 const [selectedRange,setSelectedRange]=useState<string|null>(null);
 useEffect(()=>{const sync=()=>{loadProducts().then(setProducts).catch(console.error);setCount(getCart().reduce((sum,line)=>sum+line.qty,0))};sync();window.addEventListener('fbs-update',sync);return()=>window.removeEventListener('fbs-update',sync)},[]);
 const active=products.filter(p=>p.active);
 const ranges=['Breeze','Faith',...[...new Set(active.map(p=>canonicalRange(p.range)))].filter(r=>r!=='Faith'&&r!=='Breeze')];
 const shown=selectedRange?active.filter(p=>canonicalRange(p.range)===selectedRange):active;
 const shop=(range:string)=>{setSelectedRange(range);document.getElementById('styles')?.scrollIntoView({behavior:'smooth'})};
 return <main className="shell editorial">
  <header className="sox-nav">
   <button type="button" aria-label="Open navigation" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
   <Link href="/" className="sox-brand">FAITH <span>BY</span> SOX.</Link>
   <Link href="/checkout" aria-label={`Shopping bag, ${count} items`} className="sox-bag"><ShoppingBag/><b>{count}</b></Link>
  </header>
  {menu&&<nav className="sox-menu"><a href="#ranges" onClick={()=>setMenu(false)}>OUR RANGES</a><a href="#styles" onClick={()=>setMenu(false)}>SHOP</a><a href="#purpose" onClick={()=>setMenu(false)}>OUR PURPOSE</a></nav>}
  <section className="sox-hero"><p className="sox-eyebrow">MORE THAN CLOTHING</p><h1>A DECLARATION<br/>OF FAITH.</h1><div className="sox-stroke"/><p className="sox-tagline">WEAR WHAT YOU BELIEVE.</p><a className="sox-cta" href="#ranges">SHOP THE RANGES <ArrowRight/></a></section>
  <section className="sox-ranges" id="ranges"><div className="sox-section-title"><span/><h2>OUR RANGES</h2><span/></div><div className="sox-range-grid">
   {ranges.map(range=><button type="button" key={range} className={`sox-range-card ${range==='Faith'?'sox-range-faith':range==='Breeze'?'sox-range-breeze':'sox-range-other'}`} onClick={()=>shop(range)}><small>THE</small><strong>{range}</strong><small>RANGE</small><span className="sox-range-arrow"><ArrowRight size={18}/></span></button>)}
   <div className="sox-range-future"><strong>MORE RANGES</strong><span>COMING SOON</span></div>
  </div></section>
  <section className="sox-styles" id="styles"><div className="sox-section-title"><span/><h2>{selectedRange?`${selectedRange.toUpperCase()} RANGE`:'FEATURED STYLES'}</h2><span/></div>{selectedRange&&<button type="button" className="sox-view-all" onClick={()=>setSelectedRange(null)}>VIEW ALL STYLES</button>}
   {shown.length?<div className="catalog-grid">{shown.map(p=><Link className="catalog-card" key={p.id} href={'/product/'+p.id}><div className="catalog-photo"><img src={p.image||'/faith-cream.webp'} alt={p.name}/></div><div className="catalog-name"><b>{p.name}</b><span>R {p.price.toFixed(2)}</span></div><small>{canonicalRange(p.range).toUpperCase()} RANGE · {p.colors.length} COLOURS</small></Link>)}</div>:<p className="sox-coming">This range is coming soon. Watch this space.</p>}
  </section>
  <section className="editorial-benefits"><div><Truck/><span>DELIVERY<br/>DETAILS AT CHECKOUT</span></div><div><ShieldCheck/><span>SECURE<br/>CHECKOUT</span></div><div><ShoppingBag/><span>EASY<br/>GUEST CHECKOUT</span></div></section>
  <section id="purpose" className="editorial-purpose"><p>FAITH-INSPIRED APPAREL</p><h2>FOR EVERYDAY LIFE.</h2><span className="underline-stroke"/></section>
  <footer className="editorial-footer"><strong>FAITH <span>BY</span> SOX.</strong><p>WEAR WHAT YOU BELIEVE.</p><small>© 2026 FAITH BY SOX</small><p className="sox-test-warning">TEST STORE — NO REAL PAYMENTS ACCEPTED YET</p></footer>
 </main>
}
