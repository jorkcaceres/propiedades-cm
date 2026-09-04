'use client';
export class FinanceError extends Error {constructor(message:string,public status:number){super(message);}}
export async function financeAction(operation:string,payload:unknown) {
 const response=await fetch(`/api/finance/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=await response.json();if(!response.ok)throw new FinanceError(data.error||'No fue posible completar la operación.',response.status);return data.result as string|null;
}
