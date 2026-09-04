import React from 'react';
import { ImageResponse } from 'next/og';
import { toDataURL } from 'qrcode';
import { amountWords,concepts,cop,displayDate,methods,type Receipt } from './finance';
// Current presentation omits periods for both legacy and new immutable snapshots.
export async function renderReceiptV2(receipt:Receipt,voided:boolean,origin:string,logoData:string) {
 if(![1,2].includes(receipt.renderer_version))throw Error('Versión de recibo no compatible.');
 const s=receipt.snapshot;const verifyURL=new URL(`/verificar/${receipt.code}`,origin).href;
 const qr=await toDataURL(verifyURL,{errorCorrectionLevel:'M',margin:4,width:224,color:{dark:'#242121',light:'#ffffff'}});
 const fields=[['Concepto',concepts[s.concept]],['Fecha del pago',displayDate(s.paid_on)],['Vivienda',`${s.property_name} · ${s.property_address}`],['Arrendatario',s.tenant_name],['Arrendador',s.landlord_name],['Pagado por',s.payer_name],['Medio de pago',methods[s.method]],...(s.reference?[['Referencia',s.reference]]:[])];
 // Reserve for wide glyphs and uninterrupted references; never truncate evidence.
 const rowHeights=fields.map(([,v])=>54+Math.max(1,Math.ceil(v.length/24))*34);
 const wordHeight=Math.max(1,Math.ceil(amountWords(s.amount).length/46))*30;
 const height=750+wordHeight+rowHeights.reduce((a,b)=>a+b,0);
 return new ImageResponse(<div style={{display:'flex',flexDirection:'column',width:720,height,background:'#ffffff',color:'#242121',fontFamily:'sans-serif'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:154,padding:'24px 44px',background:'#f3e500'}}><img src={logoData} width={156} height={100} alt=""/><div style={{display:'flex',flexDirection:'column',fontSize:25,textAlign:'right'}}><span>RECIBO</span><span>DE PAGO</span></div></div>
  <div style={{display:'flex',flexDirection:'column',padding:'30px 44px 0'}}>
   <div style={{display:'flex',fontSize:25,color:voided?'#a32424':'#245636',marginBottom:12}}>{voided?'ANULADO':'PAGO RECIBIDO'}</div>
   <div style={{display:'flex',fontSize:60,fontWeight:700,letterSpacing:-2}}>{cop(s.amount)} COP</div>
   <div style={{display:'flex',fontSize:23,lineHeight:1.3,height:wordHeight+12,marginTop:6}}>{amountWords(s.amount)}</div>
   <div style={{display:'flex',flexDirection:'column',marginTop:24}}>{fields.map(([label,value],i)=><div key={label} style={{display:'flex',flexDirection:'column',height:rowHeights[i],paddingTop:12,borderTop:'1px solid #e2e2e5'}}><span style={{fontSize:22,color:'#64636a',marginBottom:5}}>{label}</span><span style={{fontSize:26,lineHeight:1.3,wordBreak:'break-all'}}>{value}</span></div>)}</div>
  </div>
  <div style={{display:'flex',flexDirection:'column',marginTop:'auto',padding:'22px 44px 28px',background:'#f6f7f9'}}>
   <div style={{display:'flex',fontSize:22,marginBottom:12}}>{receipt.code}</div><div style={{display:'flex',gap:22,alignItems:'center'}}><img src={qr} width={184} height={184} alt=""/><div style={{display:'flex',flexDirection:'column',fontSize:23,lineHeight:1.4,width:400}}><span>Consulta el estado actual</span><span>y compara los datos.</span><span style={{fontSize:20,marginTop:12}}>propiedadescm.jorkcaceres.com</span></div></div>
   <div style={{display:'flex',fontSize:20,lineHeight:1.4,marginTop:14}}>Acredita únicamente el valor registrado. No constituye paz y salvo. La verificación no publica datos personales.</div><div style={{display:'flex',fontSize:18,color:'#64636a',marginTop:16}}>© 2026. Jorkcáceres. · Emitido {displayDate(receipt.issued_at)} · v2</div>
  </div>
 </div>,{width:720,height,headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="${receipt.code}.png"`}});
}
