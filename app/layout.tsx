import './style.css';
import type {Metadata} from 'next';
const site='https://faithbysox.co.za';
export const metadata:Metadata={
 metadataBase:new URL(site),
 title:{default:'FAITH BY SOX | Christian Clothing South Africa',template:'%s | FAITH BY SOX'},
 description:'Shop FAITH BY SOX Christian clothing in South Africa. Discover bold faith-inspired T-shirts, printed cross caps, gaming pads and stickers. FOR HIS GLORY.',
 alternates:{canonical:'/'},
 robots:{index:true,follow:true},
 openGraph:{type:'website',url:site,siteName:'FAITH BY SOX',title:'FAITH BY SOX | For His Glory',description:'Bold Christian clothing and faith-inspired apparel in South Africa.'},
 twitter:{card:'summary_large_image',title:'FAITH BY SOX | For His Glory',description:'Christian apparel and faith-inspired designs. Shop online in South Africa.'}
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-ZA"><body>{children}</body></html>}
