import React from 'react';
import Link from 'next/link';
import { pageCount,pageHref } from '@/lib/pagination';
export function Pagination({page,total,path,filters={}}:{page:number;total:number;path:string;filters?:Record<string,string>}){
 const pages=pageCount(total);const href=(n:number)=>pageHref(path,n,filters);
 if(page>pages)return <nav className="pagination" aria-label="Páginas de resultados"><span>No hay resultados en esta página.</span><Link href={href(1)} prefetch={false}>Volver a la primera</Link></nav>;
 return <nav className="pagination" aria-label="Páginas de resultados">
  {page>1&&<Link href={href(1)} prefetch={false}>Primera</Link>}
  {page>1?<Link href={href(page-1)} prefetch={false} rel="prev">Anterior</Link>:<span className="pagination-disabled" aria-disabled="true">Anterior</span>}
  <span className="pagination-current" aria-current="page">Página {page} de {pages}</span>
  {page<pages?<Link href={href(page+1)} prefetch={false} rel="next">Siguiente</Link>:<span className="pagination-disabled" aria-disabled="true">Siguiente</span>}
  {page<pages&&<Link href={href(pages)} prefetch={false}>Última</Link>}
 </nav>;
}
