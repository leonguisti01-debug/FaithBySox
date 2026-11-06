"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Menu,X,ShoppingBag,Truck,ShieldCheck,ArrowRight} from 'lucide-react';
import {Product,loadProducts,getCart} from '../lib/store';
const images=['/faith-black.webp','/faith-white.webp','/faith-cream.webp','/faith-brown.webp'];
export default function Home(){
 const [products,setProducts]=useState<Product[]>([]),[count,setCount]=useState(0),[menu,setMenu]=useState(false);
 useEffect(()=>{const sync=()=>{loadProducts().then(setProducts).catch(console.error);setCount(getCart().reduce((s,i)=>s+i.qty,0))};sync();window.addEventListener('fbs-update',sync);return()=>window.removeEventListener('fbs-update',sync)},[]);
 const featured=products.find(p=>p.id==='faith-over-fear')||products[0];
 const active=products.filter(p=>p.active);
 const ranges=[...new Set(['Faith','Breeze',...active.map(p=>p.collection||'Faith')])];
 const [range,setRange]=useState('All');
 const shown=range==='All'?active:active.filter(p=>(p.collection||'Faith').toLowerCase()===range.toLowerCase());
 return <main className="shell editorial">
  <header className="original-header"><img src="/original-brand-header.webp" alt="FAITH BY SOX original brand logo"/><button className="original-menu" aria-label="Open menu" onClick={()=>setMenu(!menu)}></button><Link className="original-cart" href="/checkout" aria-label={`Shopping bag, ${count} items`}></Link>{menu&&<nav className="campaign-menu"><button onClick={()=>setMenu(false)} aria-label="Close menu"><X/></button><a href="#ranges" onClick={()=>setMenu(false)}>OUR RANGES</a><a href="#collection" onClick={()=>setMenu(false)}>SHOP SHIRTS</a><Link href="/admin">ADMIN</Link></nav>}</header>
  <section className="restored-hero"><p>MORE THAN CLOTHING</p><h1>A DECLARATION<br/>OF FAITH.</h1><span className="underline-stroke light"/><p className="hero-subline">WEAR WHAT YOU BELIEVE.</p><a className="restored-cta" href="#ranges">SHOP THE RANGES <ArrowRight size={20}/></a></section>
  <section id="ranges" className="restored-ranges"><div className="collection-title"><span/><h2>OUR RANGES</h2><span/></div><div className="range-grid">{ranges.map((name,i)=><button key={name} className={'range-tile '+(range===name?'selected':'')} onClick={()=>{setRange(name);document.getElementById('collection')?.scrollIntoView({behavior:'smooth'})}}><strong>{name.toUpperCase()}</strong><small>{name.toLowerCase()==='faith'?'FAITH RANGE':name.toLowerCase()==='breeze'?'BREEZE RANGE':'EXPLORE THE RANGE'}</small><ArrowRight size={20}/></button>)}</div></section>
  <section id="collection" className="editorial-collection"><div className="collection-title"><span/><h2>FEATURED STYLES</h2><span/></div><p className="collection-kicker">FOR HIS GLORY · COLLECTION 001</p><div className="color-gallery">{images.map((img,i)=><Link key={img} href={'/product/'+(featured?.id||'faith-over-fear')} className="color-card"><img src={img} alt={`Faith Over Fear T-shirt in ${['black','white','cream','brown'][i]}`}/><div className="color-name">{['BLACK','WHITE','CREAM','BROWN'][i]}</div></Link>)}</div><div className="gallery-dots" aria-hidden="true"><b/><i/><i/><i/></div>
  <div className="product-header"><span>EXPLORE THE COLLECTIONS</span><h2>FIND YOUR <em>STATEMENT.</em></h2></div><div className="range-filters"><button className={range==='All'?'active':''} onClick={()=>setRange('All')}>ALL</button>{ranges.map(n=><button key={n} className={range===n?'active':''} onClick={()=>setRange(n)}>{n.toUpperCase()}</button>)}</div><div className="catalog-grid">{shown.map(p=><Link className="catalog-card" key={p.id} href={'/product/'+p.id}><div className="catalog-photo"><img src={p.image||(p.id==='glory'?'/glory-back.webp':p.id==='forgiven'?'/forgiven-back.webp':'/faith-cream.webp')} alt={p.name}/></div><div className="catalog-name"><b>{p.name}</b><span>R {p.price.toFixed(2)}</span></div><small>{p.collection||'Faith'} · {p.colors.length} COLOURS</small></Link>)}</div>{shown.length===0&&<p className="range-empty">THIS RANGE IS COMING SOON.</p>}<Link className="collection-action" href="/checkout">YOUR BAG <ArrowRight size={18}/></Link></section>
  <section className="editorial-benefits"><div><Truck/><span>NATIONWIDE<br/>DELIVERY</span></div><div><ShieldCheck/><span>YOCO TEST CHECKOUT<br/>NO REAL PAYMENTS</span></div><div><ShoppingBag/><span>GUEST<br/>CHECKOUT</span></div></section>
  <section className="editorial-purpose"><p>FAITH. IDENTITY. PURPOSE.</p><h2>WORN BOLDLY.<br/>LIVED FULLY.</h2><span className="underline-stroke"/></section>
  <footer className="editorial-footer"><strong>FAITH <span>BY</span> SOX.</strong><p>FOR HIS GLORY · COLLECTION 001</p><small>© 2026 FAITH BY SOX</small></footer><div className="editorial-bag"><Link href="/checkout">{count?`${count} ITEM(S) IN YOUR BAG · TEST CHECKOUT`:'YOUR BAG IS EMPTY · VIEW BAG'}</Link></div>
 </main>
}
