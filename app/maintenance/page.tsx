import Image from 'next/image';
export const metadata={title:'We’ll be back soon | FAITH BY SOX',robots:{index:false,follow:false}};
export default function Maintenance(){return <main style={{minHeight:'100dvh',background:'#171615',display:'flex',justifyContent:'center',alignItems:'center'}}><Image src="/faithbysox-maintenance.png" alt="FAITH BY SOX. We're making some changes. We'll be back soon." width={1169} height={1536} priority sizes="(max-width: 760px) 100vw, 760px" style={{display:'block',width:'100%',maxWidth:760,height:'auto'}}/></main>}
