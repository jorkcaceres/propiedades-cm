import { concepts,methods,cop,amountWords,displayDate,type Snapshot } from '@/lib/finance';
export function ReceiptDetails({snapshot:s}:{snapshot:Snapshot}) {
 const fields=[['Concepto',concepts[s.concept]],['Fecha del pago',displayDate(s.paid_on)],...(s.period_start?[['Periodo',`${displayDate(s.period_start)} al ${displayDate(s.period_end)}`]]:[]),['Vivienda',s.property_name],['Dirección',s.property_address],['Arrendatario',s.tenant_name],['Arrendador',s.landlord_name],['Pagado por',s.payer_name],['Medio de pago',methods[s.method]],['Referencia',s.reference||'Sin referencia']];
 return <section className="receipt-details record-card"><p className="finance-amount">{cop(s.amount)} COP</p><p className="muted">{amountWords(s.amount)}</p><dl className="record-details">{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}
