import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { configured } from '@/lib/supabase';
import { receiptCode,concepts,cop,amountWords,displayDate } from '@/lib/finance';
export const dynamic='force-dynamic';
export const metadata={title:'Verificar recibo | Propiedades CM',robots:{index:false,follow:false}};
export default async function VerifyPage({params}:{params:Promise<{code:string}>}) {
 const{code}=await params;if(!receiptCode.safeParse(code).success)notFound();
 if(!configured())return <main className="status-page"><h1>Verificación no disponible</h1><p>Intenta nuevamente más tarde. No se ha confirmado la validez de este recibo.</p></main>;
 // Deliberately anonymous: no cookies, session refresh, private rows or privileged key.
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const{data:r,error}=await client.rpc('pcm_verify_receipt',{receipt_code:code});
 if(error)return <main className="status-page"><h1>No pudimos verificar el recibo</h1><p>Intenta nuevamente más tarde. Este resultado no confirma su validez.</p></main>;
 return <div className="account-page"><header className="account-header"><img className="account-logo" src="/brand/logo-white.png" width={1650} height={1054} alt="Propiedades CM"/></header><main className="verification-page"><h1>Verificación de recibo</h1><p className="receipt-code">{code}</p>{!r?<div className="error"><h2>Recibo no encontrado</h2><p>Este código no corresponde a un recibo emitido en la plataforma. Confírmalo con el administrador.</p></div>:<><div className={r.voided?'error':'success-note'}><h2>{r.voided?'Recibo anulado':'Recibo vigente'}</h2><p>{r.voided?'No debe utilizarse como comprobante vigente.':'El código existe en el registro oficial de Propiedades CM.'}</p></div><section className="record-card"><p className="finance-amount">{cop(r.amount)} COP</p><p className="muted">{amountWords(r.amount)}</p><dl className="record-details"><div><dt>Concepto</dt><dd>{concepts[r.concept as keyof typeof concepts]}</dd></div><div><dt>Fecha del pago</dt><dd>{displayDate(r.paid_on)}</dd></div></dl></section><p className="notice">Compara estos datos con el PNG recibido. El QR no garantiza que una imagen no haya sido editada ni valida por sí solo la identidad de su portador. Por privacidad, aquí no se publican nombres ni direcciones.</p></>}<p className="small muted">Consulta únicamente en propiedadescm.jorkcaceres.com. Este recibo acredita el importe registrado, no un paz y salvo.</p></main><footer className="account-footer">© 2026. Jorkcáceres.</footer></div>;
}
