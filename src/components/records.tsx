'use client';
import { useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { modules,type ModuleKey,type DataRecord } from '@/lib/modules';

type Field={key:string;label:string;required?:boolean;type?:string;max?:number;options?:{value:string;label:string}[]};
const documentOptions=['CC','CE','NIT','PAS','OTRO'].map(value=>({value,label:value}));
export function Records({module,records,landlords,rights}:{module:ModuleKey;records:DataRecord[];landlords:{id:string;name:string;active:boolean}[];rights:{create:boolean;edit:boolean;archive:boolean}}) {
  const router=useRouter();const [pending,startTransition]=useTransition();
  const [editing,setEditing]=useState<DataRecord|'new'|null>(null);
  const [values,setValues]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const fields:Field[]=module==='properties'?[
    {key:'name',label:'Nombre o identificación de la vivienda',required:true,max:150},
    {key:'address',label:'Dirección',required:true,max:250},
    {key:'landlord_id',label:'Arrendador',required:true,options:landlords.filter(l=>l.active||l.id===values.landlord_id).map(l=>({value:l.id,label:l.name+(l.active?'':' (inactivo)')}))},
    {key:'property_type',label:'Tipo de vivienda',required:true,options:[{value:'casa',label:'Casa'},{value:'apartamento',label:'Apartamento'},{value:'habitacion',label:'Habitación'},{value:'otro',label:'Otro'}]},
    {key:'neighborhood',label:'Barrio',max:100},{key:'city',label:'Municipio',required:true,max:100},{key:'department',label:'Departamento',required:true,max:100},
    {key:'bedrooms',label:'Habitaciones',type:'number'},{key:'bathrooms',label:'Baños',type:'number'},{key:'area_m2',label:'Área (m²)',type:'number'},
    {key:'notes',label:'Observaciones',type:'textarea',max:2000},
  ]:[
    {key:'name',label:'Nombre completo o razón social',required:true,max:150},
    {key:'document_type',label:'Tipo de documento',required:true,options:documentOptions},
    {key:'document_number',label:'Número de documento',required:true,max:30},
    {key:'email',label:'Correo electrónico',type:'email',max:254},{key:'phone',label:'Teléfono',type:'tel',max:30},
    {key:'address',label:'Dirección de contacto',max:250},{key:'notes',label:'Observaciones',type:'textarea',max:2000},
  ];
  function open(record:DataRecord|'new') {
    setError('');setNotice('');setEditing(record);
    setValues(record==='new'?module==='properties'?{city:'Soledad',department:'Atlántico',property_type:'casa'}:{document_type:'CC'}:Object.fromEntries(fields.map(f=>[f.key,String(record[f.key]??'')])));
  }
  async function send(method:string,payload:unknown) {
    const response=await fetch(`/api/records/${module}`,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json();if(!response.ok) throw Error(result.error||'No fue posible guardar.');
  }
  async function save(event:React.FormEvent) {
    event.preventDefault();if(busy||pending||!editing)return;setBusy(true);setError('');setNotice('');
    try {
      const clean=Object.fromEntries(fields.map(f=>[f.key,(values[f.key]||'').trim()]));
      await send(editing==='new'?'POST':'PATCH',editing==='new'?clean:{action:'edit',id:editing.id,version:editing.version,values:clean});
      setEditing(null);setNotice('Cambios guardados.');startTransition(()=>router.refresh());
    } catch(e){setError(e instanceof Error?e.message:'No fue posible guardar.');} finally{setBusy(false);}
  }
  async function changeState(record:DataRecord) {
    if(busy||pending||!window.confirm(`${record.active?'Inactivar':'Reactivar'} a «${record.name}»? El historial se conservará.`)) return;
    setBusy(true);setError('');setNotice('');
    try{await send('PATCH',{action:'archive',id:record.id,version:record.version,active:!record.active});setNotice('Estado actualizado.');startTransition(()=>router.refresh());}
    catch(e){setError(e instanceof Error?e.message:'No fue posible actualizar.');}finally{setBusy(false);}
  }
  return <section aria-label={modules[module].label} aria-busy={busy||pending}>
    {!editing&&rights.create&&<button className="action-primary" onClick={()=>open('new')}>Crear {modules[module].singular}</button>}
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success-note" role="status">{notice}</p>}
    {editing?<form className="editor" onSubmit={save}>
      <h2>{editing==='new'?'Crear':'Editar'} {modules[module].singular}</h2><p className="muted">Los campos marcados con * son obligatorios.</p>
      {module==='properties'&&!landlords.some(l=>l.active)&&<p className="notice">Primero registra un arrendador activo. Necesitas permiso para consultar arrendadores.</p>}
      <fieldset disabled={busy||pending}><div className="form-grid">{fields.map(f=><label key={f.key}>{f.label}{f.required?' *':''}
        {f.options?<select required={f.required} value={values[f.key]||''} onChange={e=>setValues({...values,[f.key]:e.target.value})}><option value="">Selecciona una opción</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
          :f.type==='textarea'?<textarea maxLength={f.max} value={values[f.key]||''} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>
          :<input type={f.type||'text'} required={f.required} maxLength={f.max} min={f.type==='number'?(f.key==='area_m2'?'0.01':'0'):undefined} max={f.type==='number'?(f.key==='area_m2'?'99999999.99':'99'):undefined} step={f.key==='area_m2'?'0.01':f.type==='number'?'1':undefined} value={values[f.key]||''} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>}
      </label>)}</div><div className="form-actions"><button className="action-primary" type="submit">{busy?'Guardando…':'Guardar'}</button><button className="action-secondary" type="button" onClick={()=>{setEditing(null);setError('');}}>Cancelar</button></div></fieldset>
    </form>:<div className="record-list">{records.length===0?<div className="empty-state"><h2>No hay registros para mostrar</h2><p>Prueba otro filtro o crea el primer registro si tienes permiso.</p></div>:records.map(record=><article key={record.id} className="record-card">
      <div className="record-title"><h2>{record.name}</h2><span className="status-tag">{record.active?'Activo':'Inactivo'}</span></div>
      <p className="muted">{module==='properties'?record.address:`${record.document_type} ${record.document_number}`}</p>
      <details><summary>Ver datos</summary><dl className="record-details">{fields.filter(f=>f.key!=='name').map(f=><div key={f.key}><dt>{f.label}</dt><dd>{f.key==='landlord_id'?(landlords.find(l=>l.id===record.landlord_id)?.name||'Sin acceso a los datos del arrendador'):(f.options?.find(o=>o.value===record[f.key])?.label||String(record[f.key]??'')||'Sin registrar')}</dd></div>)}</dl></details>
      <div className="form-actions">{rights.edit&&<button className="action-secondary" disabled={busy||pending} onClick={()=>open(record)}>Editar</button>}{rights.archive&&<button className="action-secondary" disabled={busy||pending} onClick={()=>changeState(record)}>{record.active?'Inactivar':'Reactivar'}</button>}</div>
    </article>)}</div>}
  </section>;
}
