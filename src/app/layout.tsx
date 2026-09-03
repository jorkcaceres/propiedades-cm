import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Propiedades CM',description:'Administración de arrendamientos y recibos de pago.',robots:{index:false,follow:false},icons:{icon:'/logo.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#f3e500'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es-CO"><body>{children}</body></html>;}
