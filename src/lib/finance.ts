import { z } from 'zod';
export const concepts={rent:'Canon de arrendamiento',advance:'Canon anticipado',deposit:'Depósito'} as const;
export const methods={transfer:'Transferencia bancaria',cash:'Efectivo',other:'Otro'} as const;
export const financeModules={leases:{label:'Arrendamientos',description:'Vincula vivienda y arrendatario, canon y fechas.'},payments:{label:'Pagos',description:'Registra el dinero recibido y su concepto.'},receipts:{label:'Recibos',description:'Emite y descarga comprobantes PNG verificables.'}} as const;
const date=z.iso.date();
const optionalDate=z.union([date,z.literal('')]).transform(v=>v||null).nullable();
const money=z.number().int().min(1).max(999999999);
const leaseFields={property_id:z.uuid(),tenant_id:z.uuid(),monthly_rent:money,start_date:date,end_date:optionalDate,due_day:z.number().int().min(1).max(31)};
export const leaseInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),...leaseFields}).strict(),
 z.object({action:z.literal('edit'),id:z.uuid(),version:z.number().int().positive(),...leaseFields}).strict(),
 z.object({action:z.literal('archive'),id:z.uuid(),version:z.number().int().positive(),active:z.boolean()}).strict(),
]).refine(v=>v.action==='archive'||!v.end_date||v.end_date>=v.start_date,{message:'La fecha final no puede ser anterior al inicio.'});
export const paymentInput=z.object({request_id:z.uuid(),lease_id:z.uuid(),amount:money,concept:z.enum(['rent','advance','deposit']),paid_on:date,method:z.enum(['transfer','cash','other']),payer_name:z.string().trim().min(2).max(150),reference:z.string().trim().max(120).default(''),notes:z.string().trim().max(500).default('')}).strict();
export const receiptInput=z.object({payment_id:z.uuid()}).strict();
export const voidInput=z.object({payment_id:z.uuid(),reason:z.string().trim().min(5).max(500)}).strict();
export const receiptCode=z.string().regex(/^PCM-[0-9A-F]{32}$/);
export type Lease={id:string;property_id:string;tenant_id:string;landlord_id:string;monthly_rent:number;start_date:string;end_date:string|null;due_day:number;active:boolean;version:number};
export type Choice={id:string;name:string;active:boolean};
export type Snapshot={property_name:string;property_address:string;tenant_name:string;landlord_name:string;payer_name:string;amount:number;concept:keyof typeof concepts;paid_on:string;method:keyof typeof methods;reference:string;currency:'COP'};
export type Payment={id:string;lease_id:string;amount:number;concept:keyof typeof concepts;paid_on:string;payer_name:string;notes:string;snapshot:Snapshot;voided_at:string|null;void_reason:string|null;created_at:string};
export type Receipt={id:string;payment_id:string;code:string;snapshot:Snapshot;renderer_version:number;issued_at:string};
export function cop(value:number){return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);}
export function displayDate(value:string|null){if(!value)return '—';return new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z'));}
export function bogotaToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
const small=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const tens=['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const hundreds=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
const apocope=(s:string)=>s.replace(/veintiuno$/,'veintiún').replace(/uno$/,'un');
function words(n:number):string {
 if(n<30)return small[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' y '+small[n%10]:'');if(n===100)return 'cien';
 if(n<1000)return hundreds[Math.floor(n/100)]+(n%100?' '+words(n%100):'');
 if(n<1000000)return (n<2000?'mil':apocope(words(Math.floor(n/1000)))+' mil')+(n%1000?' '+words(n%1000):'');
 return (n<2000000?'un millón':apocope(words(Math.floor(n/1000000)))+' millones')+(n%1000000?' '+words(n%1000000):'');
}
export function amountWords(n:number){if(!Number.isInteger(n)||n<1||n>999999999)throw Error('Valor no válido.');if(n===1)return 'un peso colombiano';return apocope(words(n))+(n%1000000===0?' de pesos colombianos':' pesos colombianos');}
