import Link from 'next/link';
import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { modules } from '@/lib/modules';
export default async function Panel() {
  const {member}=await access();
  return <><div className="page-heading"><span className="eyebrow">PROPIEDADES CM</span><h1>Hola, {member.name}.</h1><p className="muted">Organiza la información de tus arrendamientos.</p></div>
    <div className="module-grid">{Object.entries(modules).filter(([key])=>can(member,`${key}.view`)).map(([key,module])=><Link prefetch={false} className="module-card" key={key} href={`/panel/${key}`}><h2>{module.label}</h2><p>{module.description}</p><span>Abrir módulo →</span></Link>)}</div>
    <section className="account-summary"><h2>Tu cuenta</h2><p>{member.email}</p><p className="muted">{member.is_admin?'Administrador':'Permisos personalizados'}</p>{can(member,'users.view')&&<Link href="/panel/users" prefetch={false}>Administrar usuarios y permisos</Link>}</section>
    <div className="notice"><strong>Próxima etapa: pagos y recibos.</strong>Registra primero los arrendadores, arrendatarios y viviendas. La emisión de comprobantes aún no está habilitada.</div>
  </>;
}
