import type { Lease } from './finance';

const validMonth=(value:string)=>/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
const monthIndex=(value:string)=>Number(value.slice(0,4))*12+Number(value.slice(5,7))-1;

// Keep the existing server/SQL contract: a month selection is one continuous period.
// Clamp boundary months to the actual lease dates without prorating the amount.
export function monthsToPeriod(months:string[],lease:Pick<Lease,'start_date'|'end_date'>) {
 if(!months.length||months.some(month=>!validMonth(month)))throw Error('Selecciona el mes o los meses que paga.');
 const sorted=[...months].sort();
 if(new Set(sorted).size!==sorted.length)throw Error('No repitas el mismo mes.');
 if(sorted.some((month,index)=>index>0&&monthIndex(month)!==monthIndex(sorted[index-1])+1))throw Error('Selecciona meses consecutivos, sin dejar meses intermedios.');
 if(sorted[0]<lease.start_date.slice(0,7)||(lease.end_date&&sorted.at(-1)!>lease.end_date.slice(0,7)))throw Error('Los meses deben estar dentro del arrendamiento.');
 const last=sorted.at(-1)!;const year=Number(last.slice(0,4));const month=Number(last.slice(5));
 const leap=year%4===0&&(year%100!==0||year%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
 const start=sorted[0]+'-01';const end=last+'-'+days;
 return {period_start:start<lease.start_date?lease.start_date:start,period_end:lease.end_date&&end>lease.end_date?lease.end_date:end};
}

export function nextMonth(value:string){
 if(!validMonth(value)||value==='9999-12')return '';
 const index=monthIndex(value)+1;
 return `${String(Math.floor(index/12)).padStart(4,'0')}-${String(index%12+1).padStart(2,'0')}`;
}

export function paymentPeriod(concept:string,months:string[],lease?:Pick<Lease,'start_date'|'end_date'>){
 if(concept==='deposit')return {period_start:null,period_end:null};
 if(!lease)throw Error('Selecciona un arrendamiento activo.');
 return monthsToPeriod(months,lease);
}
