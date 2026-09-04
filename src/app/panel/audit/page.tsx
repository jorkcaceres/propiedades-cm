import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
const labels:Record<string,string>={member:'Usuario',landlords:'Arrendador',tenants:'Arrendatario',properties:'Vivienda',leases:'Arrendamiento',payments:'Pago',receipts:'Recibo',insert:'Creación',update:'Actualización',archive:'Inactivación',restore:'Reactivación'};
export default async function ActivityPage() {
  const {client,member}=await access();
  if(!can(member,'audit.view'))return <section className="empty-state"><h1>Acceso restringido</h1><p>No tienes permiso para consultar la actividad.</p></section>;
  const {data,error}=await client.from('pcm_audit_events').select('id,occurred_at,entity,entity_id,action,actor_id,actor_kind').order('occurred_at',{ascending:false}).order('id').limit(50);
  if(error)throw Error('No fue posible consultar la actividad.');
  return <><div className="page-heading"><h1>Actividad</h1><p className="muted">Últimos 50 eventos. El historial se conserva y no se puede modificar desde la plataforma.</p></div><div className="record-list">{!data?.length?<p className="empty-state">No hay eventos registrados.</p>:data.map(event=><article className="record-card" key={event.id}><h2>{labels[event.action]||event.action} · {labels[event.entity]||event.entity}</h2><p>{new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(event.occurred_at))}</p><p className="small muted">Registro: {event.entity_id}</p><p className="small muted">Responsable: {event.actor_kind==='database_admin'?'Administración de base de datos':event.actor_id}</p></article>)}</div></>;
}
