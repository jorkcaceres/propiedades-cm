'use client';
import { useRef,useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentScope,StoredDocument } from '@/lib/assets';

type Rights={view:boolean;upload:boolean;edit:boolean;delete:boolean};
const mb=(bytes:number)=>bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;
export function EntityDocuments({scope,entityId,documents,rights,embedded=false}:{scope:DocumentScope;entityId:string;documents:StoredDocument[];rights:Rights;embedded?:boolean}){
 const router=useRouter();const[fileInput]=useState(()=>`document-${scope}-${entityId}`);const formRef=useRef<HTMLFormElement>(null);
 const[pending,startTransition]=useTransition();const[busy,setBusy]=useState(false);const[editing,setEditing]=useState<StoredDocument|'new'|null>(null);const[viewer,setViewer]=useState<StoredDocument|null>(null);const[error,setError]=useState('');
 async function result(response:Response){const value=await response.json();if(!response.ok)throw Error(value.error||'No fue posible completar la operación.');return value;}
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!editing||busy||pending)return;setBusy(true);setError('');
  try{
   const form=new FormData(event.currentTarget);const name=String(form.get('name')||'').trim();const file=form.get('file');const hasFile=file instanceof File&&file.size>0;
   if(editing!=='new'&&!hasFile)await result(await fetch(`/api/documents/${scope}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'rename',id:editing.id,version:editing.version,name})}));
   else{
    form.set('entity_id',entityId);if(editing!=='new'){form.set('document_id',editing.id);form.set('version',String(editing.version));}
    await result(await fetch(`/api/documents/${scope}`,{method:'POST',body:form}));
   }
   setEditing(null);formRef.current?.reset();startTransition(()=>router.refresh());
  }catch(e){setError(e instanceof Error?e.message:'No fue posible guardar.');}finally{setBusy(false);}
 }
 async function remove(document:StoredDocument){
  if(busy||pending||!window.confirm(`¿Eliminar «${document.name}»? El PDF también se eliminará permanentemente del almacenamiento.`))return;
  setBusy(true);setError('');try{await result(await fetch(`/api/documents/${scope}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:document.id,version:document.version})}));startTransition(()=>router.refresh());}
  catch(e){setError(e instanceof Error?e.message:'No fue posible eliminar.');}finally{setBusy(false);}
 }
 if(!rights.view)return null;
 const current=editing&&editing!=='new'?editing:null;
 const content=<section className="asset-section" aria-busy={busy||pending}>
  <div className="asset-heading"><div><h3>Documentos</h3><p className="small muted">Archivos PDF privados, máximo 20 MB.</p></div>{rights.upload&&!editing&&<button className="action-secondary" onClick={()=>{setEditing('new');setError('');}}>Adjuntar PDF</button>}</div>
  {error&&<p className="error" role="alert">{error}</p>}
  {editing&&<form ref={formRef} className="asset-editor" onSubmit={save}><fieldset disabled={busy||pending}><label>Nombre del documento *<input name="name" required minLength={2} maxLength={150} defaultValue={current?.name||''}/></label><label htmlFor={fileInput}>{current?'Reemplazar PDF (opcional)':'Archivo PDF *'}<input id={fileInput} name="file" type="file" accept="application/pdf,.pdf" required={!current}/></label><p className="small muted">{current?'Si no seleccionas un archivo, solo se actualizará el nombre.':'Solo PDF. El archivo no puede superar 20 MB.'}</p><div className="form-actions"><button className="action-primary" type="submit">{busy?'Guardando…':current?'Guardar cambios':'Cargar documento'}</button><button className="action-secondary" type="button" onClick={()=>{setEditing(null);setError('');}}>Cancelar</button></div></fieldset></form>}
  {!documents.length&&!editing?<p className="asset-empty">No hay documentos adjuntos.</p>:<div className="asset-list">{documents.map(document=><div className="asset-item" key={document.id}><div><strong>{document.name}</strong><span>{mb(document.size_bytes)} · PDF</span></div><div className="asset-actions"><button className="action-secondary" onClick={()=>setViewer(document)}>Ver</button>{rights.edit&&<button className="action-secondary" onClick={()=>{setEditing(document);setError('');}}>Editar</button>}{rights.delete&&<button className="action-secondary danger-action" onClick={()=>void remove(document)}>Eliminar</button>}</div></div>)}</div>}
  {viewer&&<div className="pdf-overlay" role="dialog" aria-modal="true" aria-label={`Vista de ${viewer.name}`}><div className="pdf-dialog"><div className="pdf-toolbar"><strong>{viewer.name}</strong><button className="action-secondary" onClick={()=>setViewer(null)}>Cerrar</button></div><iframe title={viewer.name} src={`/api/documents/${scope}/${viewer.id}/view`}/></div></div>}
 </section>;
 return embedded?content:<details className="asset-panel"><summary>Documentos <span>{documents.length}</span></summary>{content}</details>;
}
