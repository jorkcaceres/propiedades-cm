'use client';
import { useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { can,permissionGroups,actionLabels,profilePermissions,type Member } from '@/lib/permissions';
export type MemberRecord=Member&{updated_at:string};
export function Members({members,actor}:{members:MemberRecord[];actor:Member}) {
  const router=useRouter();const [pending,startTransition]=useTransition();const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<MemberRecord|'new'|null>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [active,setActive]=useState(true);const [admin,setAdmin]=useState(false);const [permissions,setPermissions]=useState<string[]>([]);
  function open(member:MemberRecord|'new') {
    setSelected(member);setError('');setNotice('');setName(member==='new'?'':member.name);setEmail(member==='new'?'':member.email);
    setActive(member==='new'?true:member.active);setAdmin(member==='new'?false:member.is_admin);setPermissions(member==='new'?[]:member.permissions);
  }
  function toggle(permission:string,checked:boolean) {
    const module=permission.split('.')[0];
    if(checked){const next=new Set([...permissions,permission,`${module}.view`]);if(permission==='properties.create'||permission==='properties.edit')next.add('landlords.view');if(['leases.create','leases.edit'].includes(permission))['properties.view','tenants.view','landlords.view'].forEach(p=>next.add(p));if(permission==='payments.create')['leases.view','properties.view','tenants.view'].forEach(p=>next.add(p));if(permission==='receipts.issue')next.add('payments.view');if(permission==='receipts.void'){next.add('payments.view');next.add('payments.void');}setPermissions([...next].filter(p=>can(actor,p)));}
    else setPermissions(permissions.filter(p=>p!==permission&&!(permission.endsWith('.view')&&p.startsWith(`${module}.`))));
  }
  async function save(event:React.FormEvent) {
    event.preventDefault();if(busy||pending||!selected)return;setBusy(true);setError('');
    try {
      const response=await fetch('/api/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected==='new'?null:selected.id,email:email.trim().toLowerCase(),name:name.trim(),active,is_admin:admin,permissions,updated_at:selected==='new'?null:selected.updated_at})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'No fue posible guardar.');
      setSelected(null);setNotice('Acceso actualizado.');startTransition(()=>router.refresh());
    }catch(e){setError(e instanceof Error?e.message:'No fue posible guardar.');}finally{setBusy(false);}
  }
  return <section aria-busy={busy||pending}>
    {!selected&&can(actor,'users.invite')&&<button className="action-primary" onClick={()=>open('new')}>Autorizar usuario</button>}
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success-note" role="status">{notice}</p>}
    {selected?<form className="editor" onSubmit={save}><h2>{selected==='new'?'Autorizar usuario':'Editar acceso'}</h2>
      {selected==='new'&&<p className="notice">La cuenta debe estar creada y confirmada previamente en Supabase Auth. Aquí autorizas su ingreso y asignas permisos; no se envía una invitación ni se solicita su contraseña.</p>}
      <fieldset disabled={busy||pending}><div className="form-grid"><label>Nombre completo *<input required minLength={2} maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label><label>Correo electrónico *<input type="email" required maxLength={254} readOnly={selected!=='new'} value={email} onChange={e=>setEmail(e.target.value)}/></label></div>
      <label className="permission-toggle"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Acceso activo</label>
      {actor.is_admin&&<label className="permission-toggle"><input type="checkbox" checked={admin} onChange={e=>setAdmin(e.target.checked)}/>Administrador: acceso completo, incluida la gestión de usuarios</label>}
      {!admin&&<><div className="form-actions"><button type="button" className="action-secondary" onClick={()=>setPermissions(profilePermissions('consulta').filter(p=>can(actor,p)))}>Solo consulta</button><button type="button" className="action-secondary" onClick={()=>setPermissions([])}>Quitar permisos</button></div>
        <p className="muted">Selecciona acciones concretas. Emitir y descargar recibos son permisos distintos. Para anular un pago con recibo se requieren ambas autorizaciones de anulación.</p>
        <div className="permission-grid">{Object.entries(permissionGroups).map(([module,group])=><fieldset className="permission-group" key={module}><legend>{group.label}</legend>{group.actions.map(action=>{const code=`${module}.${action}`;return <label className="permission-toggle" key={code}><input type="checkbox" checked={permissions.includes(code)} disabled={!can(actor,code)||(!actor.is_admin&&['users.manage','users.invite'].includes(code))} onChange={e=>toggle(code,e.target.checked)}/>{actionLabels[action]}</label>;})}</fieldset>)}</div></>}
      <div className="form-actions"><button type="submit" className="action-primary">{busy?'Guardando…':'Guardar acceso'}</button><button type="button" className="action-secondary" onClick={()=>{setSelected(null);setError('');}}>Cancelar</button></div></fieldset>
    </form>:<div className="record-list">{members.map(member=><article className="record-card" key={member.id}><div className="record-title"><h2>{member.name}</h2><span className="status-tag">{member.active?'Activo':'Suspendido'}</span></div><p>{member.email}</p><p className="muted">{member.is_admin?'Administrador':`${member.permissions.length} permisos asignados`}{member.id===actor.id?' · Tu cuenta':''}</p>
      {can(actor,'users.manage')&&member.id!==actor.id&&(actor.is_admin||(!member.is_admin&&member.permissions.every(p=>actor.permissions.includes(p))))&&<button className="action-secondary" onClick={()=>open(member)}>Editar acceso</button>}
    </article>)}</div>}
  </section>;
}
