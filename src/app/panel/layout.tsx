import { redirect } from 'next/navigation';
import { access,HttpError } from '@/lib/access';
import { can } from '@/lib/permissions';
import { Logout } from '@/components/logout';
import { PanelNav } from '@/components/panel-nav';
export const dynamic='force-dynamic';
export default async function PanelLayout({children}:{children:React.ReactNode}) {
  let member;
  try {({member}=await access());} catch(error) {
    if(error instanceof HttpError&&(error.status===401||error.message.includes('aún no está habilitado'))) redirect('/login');
    if(error instanceof HttpError&&error.status===403) return <main className="status-page"><h1>Acceso no autorizado</h1><p>Tu cuenta no tiene acceso activo. Contacta al administrador.</p><Logout /></main>;
    throw error;
  }
  const items=[{href:'/panel',label:'Inicio'},
    ...[['landlords','Arrendadores'],['tenants','Arrendatarios'],['properties','Viviendas'],['users','Usuarios'],['audit','Actividad']]
      .filter(([module])=>can(member,`${module}.view`)).map(([module,label])=>({href:`/panel/${module}`,label}))];
  return <div className="account-page">
    <a className="skip" href="#panel-content">Ir al contenido</a>
    <header className="account-header"><img className="account-logo" src="/brand/logo-white.png" width={1650} height={1054} alt="Propiedades CM" /><Logout /></header>
    <PanelNav items={items} />
    <main className="panel-content" id="panel-content">{children}</main>
    <footer className="account-footer">© 2026. Jorkcáceres.</footer>
  </div>;
}
