import Link from 'next/link';
export default function NotFound() {
  return <main className="status-page"><span className="eyebrow">PROPIEDADES CM · 404</span><h1>No encontramos esta página.</h1><p className="muted">Revisa la dirección o vuelve al inicio de sesión.</p><Link className="primary" href="/login">Volver al acceso</Link></main>;
}
