import type {Metadata,Viewport} from 'next';
import './globals.css';

export const metadata:Metadata={title:'Hot Tacos | Production Control',description:'Inventory counts and kitchen production management / Conteos y control de producción',applicationName:'Hot Tacos Production Control',robots:{index:false,follow:false},appleWebApp:{capable:true,title:'HT Production',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#17365b'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
