export const permissionGroups = {
  properties: { label: 'Viviendas', actions: ['view','create','edit','archive'] },
  property_references: { label: 'Servicios de viviendas', actions: ['view','create','edit','delete'] },
  property_documents: { label: 'Documentos de viviendas', actions: ['view','upload','edit','delete'] },
  landlords: { label: 'Arrendadores', actions: ['view','create','edit','archive'] },
  tenants: { label: 'Arrendatarios', actions: ['view','create','edit','archive'] },
  leases: { label: 'Arrendamientos', actions: ['view','create','edit','archive'] },
  lease_documents: { label: 'Documentos de arrendamientos', actions: ['view','upload','edit','delete'] },
  payments: { label: 'Pagos', actions: ['view','create','void'] },
  receipts: { label: 'Recibos', actions: ['view','issue','download','void'] },
  users: { label: 'Usuarios', actions: ['view','invite','manage'] },
  audit: { label: 'Actividad', actions: ['view'] },
} as const;
export const actionLabels: Record<string,string> = {view:'Consultar',create:'Crear',upload:'Cargar',edit:'Editar',delete:'Eliminar',archive:'Inactivar',void:'Anular',issue:'Emitir',download:'Descargar y compartir',invite:'Invitar',manage:'Administrar permisos'};
export const allPermissions = Object.entries(permissionGroups).flatMap(([key,g])=>g.actions.map(a=>`${key}.${a}`));
export type Member = { id:string; name:string; email:string; active:boolean; is_admin:boolean; permissions:string[] };
export const can = (member:Member, permission:string) => member.active && (member.is_admin || member.permissions.includes(permission));
export function profilePermissions(profile:string):string[] {
  if(profile==='consulta') return allPermissions.filter(p=>p.endsWith('.view')&&!p.startsWith('users.')&&!p.startsWith('audit.'));
  if(profile==='operador') return allPermissions.filter(p=>!p.startsWith('users.')&&!p.startsWith('audit.')&&!p.endsWith('.void')&&!p.endsWith('.archive'));
  return [];
}
