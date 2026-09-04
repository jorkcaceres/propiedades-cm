'use client';
import { useState } from 'react';
export function ReceiptDownload({code}:{code:string}) {
 const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 async function download(){if(busy)return;setBusy(true);setError('');try{const response=await fetch(`/api/receipts/${code}/png`);if(!response.ok){const result=await response.json();throw Error(result.error||'No fue posible generar el PNG.');}const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${code}.png`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){setError(e instanceof Error?e.message:'No fue posible descargar.');}finally{setBusy(false);}}
 return <div><button disabled={busy} onClick={()=>void download()} className="action-primary">{busy?'Preparando PNG…':'Descargar recibo PNG'}</button>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
