'use client';
import { useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PropertyReference,StoredDocument } from '@/lib/assets';
import { EntityDocuments } from './entity-documents';

type ReferenceRights={view:boolean;create:boolean;edit:boolean;delete:boolean};
type DocumentRights={view:boolean;upload:boolean;edit:boolean;delete:boolean};
export function PropertyAssets({propertyId,references,documents,referenceRights,documentRights}:{propertyId:string;references:PropertyReference[];documents:StoredDocument[];referenceRights:ReferenceRights;documentRights:DocumentRights}){
 const router=useRouter();const[pending,startTransition]=useTransition();const[busy,setBusy]=useState(false);const[editing,setEditing]=useState<PropertyReference|'new'|null>(null);const[error,setError]=useState('');
 async function send(payload:unknown,method='PATCH'){const response=await fetch('/api/property-references',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw Error(result.error||'No fue posible completar la operación.');}
 async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!editing||busy||pending)return;setBusy(true);setError('');try{const form=new FormData(event.currentTarget);const values={identifier_type:form.get('identifier_type'),identifier:form.get('identifier'),company:form.get('company'),service:form.get('service')};await send(editing==='new'?{property_id:propertyId,...values}:{action:'edit',id:editing.id,version:editing.version,values},editing==='new'?'POST':'PATCH');setEditing(null);startTransition(()=>router.refresh());}catch(e){setError(e instanceof Error?e.message:'No fue posible guardar.');}finally{setBusy(false);}}
 async function remove(reference:PropertyReference){if(!window.confirm(`¿Eliminar la referencia de ${reference.company}?`))return;setBusy(true);setError('');try{await send({action:'delete',id:reference.id,version:reference.version});startTransition(()=>router.refresh());}catch(e){setError(e instanceof Error?e.message:'No fue posible eliminar.');}finally{setBusy(false);}}
 const current=editing&&editing!=='new'?editing:null;
 return <details className="asset-panel"><summary>Servicios y documentos <span>{references.length+documents.length}</span></summary><div className="assets-wrap">
  {referenceRights.view&&<section className="asset-section" aria-busy={busy||pending}><div className="asset-heading"><div><h3>Servicios y referencias</h3><p className="small muted">Identificadores de servicios, pólizas y contratos.</p></div>{referenceRights.create&&!editing&&<button className="action-secondary" onClick={()=>{setEditing('new');setError('');}}>Agregar</button>}</div>
   {error&&<p className="error" role="alert">{error}</p>}
   {editing&&<form className="asset-editor" onSubmit={save}><fieldset disabled={busy||pending}><div className="form-grid"><label>Tipo de identificación *<input name="identifier_type" required minLength={2} maxLength={80} placeholder="NIC, contrato, póliza…" defaultValue={current?.identifier_type||''}/></label><label>Identificación *<input name="identifier" required maxLength={150} defaultValue={current?.identifier||''}/></label><label>Compañía *<input name="company" required minLength={2} maxLength={150} defaultValue={current?.company||''}/></label><label>Servicio *<input name="service" required minLength={2} maxLength={120} defaultValue={current?.service||''}/></label></div><div className="form-actions"><button className="action-primary">{busy?'Guardando…':'Guardar'}</button><button className="action-secondary" type="button" onClick={()=>{setEditing(null);setError('');}}>Cancelar</button></div></fieldset></form>}
   {!references.length&&!editing?<p className="asset-empty">No hay servicios o referencias registrados.</p>:<div className="asset-list">{references.map(reference=><div className="asset-item" key={reference.id}><div><strong>{reference.service}</strong><span>{reference.company} · {reference.identifier_type}: {reference.identifier}</span></div><div className="asset-actions">{referenceRights.edit&&<button className="action-secondary" onClick={()=>{setEditing(reference);setError('');}}>Editar</button>}{referenceRights.delete&&<button className="action-secondary danger-action" onClick={()=>void remove(reference)}>Eliminar</button>}</div></div>)}</div>}
  </section>}
  <EntityDocuments scope="property" entityId={propertyId} documents={documents} rights={documentRights} embedded/>
 </div></details>;
}
