import { redirect } from 'next/navigation';
import { access, HttpError } from '@/lib/access';
import { Logout } from '@/components/logout';
export const dynamic='force-dynamic';

export default async function Panel() {
  let member;
  try { ({member}=await access()); }
  catch(error) {
    if(error instanceof HttpError && (error.status===401 || error.status===503)) {
      if(error.status===401 || error.message.includes('aún no está habilitado')) redirect('/login');
    }
    if(error instanceof HttpError && error.status===403) return <main className="status-page"><h1>Acceso no autorizado</h1><p>Tu cuenta no tiene acceso activo. Contacta al administrador.</p><Logout /></main>;
    throw error;
  }
  return <main className="account-page">
    <header className="account-header"><span className="brand"><span>PROPIEDADES <b>CM</b></span></span><Logout /></header>
    <section className="account-card" aria-labelledby="account-title">
      <span className="eyebrow">MI CUENTA</span>
      <h1 id="account-title">Hola, {member.name}.</h1>
      <p className="muted">Tu acceso está activo.</p>
      <dl className="account-details"><div><dt>Correo electrónico</dt><dd>{member.email}</dd></div><div><dt>Perfil</dt><dd>{member.is_admin?'Administrador':'Acceso con permisos asignados'}</dd></div></dl>
      <div className="notice"><strong>La plataforma está en preparación.</strong>Los módulos de usuarios, viviendas y recibos todavía no están disponibles.</div>
    </section>
    <footer className="account-footer">© 2026. Jorkcáceres.</footer>
  </main>;
}
