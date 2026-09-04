'use client';
import { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Turnstile } from './turnstile';

export function Login({ configured, turnstileSiteKey }: { configured: boolean; turnstileSiteKey: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [token, setToken] = useState('');
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy || !turnstileSiteKey || !token) return;
    setBusy(true);
    setError('');
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(fields), turnstileToken: token }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'No fue posible ingresar.');
      window.location.assign('/panel');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No fue posible ingresar.');
    } finally {
      setBusy(false);
      setToken('');
      setChallengeAttempt(attempt => attempt + 1);
    }
  }
  return (
    <main className="login-page">
      <a className="skip" href="#acceso">Ir al acceso</a>
      <aside className="login-brand" aria-label="Propiedades CM">
        <div className="login-logo">
          <img src="/brand/logo-white.png" width={1650} height={1054} alt="Propiedades CM" />
        </div>
        <div className="login-statement">
          <h2>Nuestras viviendas.<br /><em>Una gestión<br />más sencilla.</em></h2>
          <p>Administración de arrendamientos y trazabilidad de pagos para nuestra familia.</p>
        </div>
        <div className="brand-foot">© 2026. Jorkcáceres.</div>
      </aside>
      <section className="login-form" id="acceso" aria-labelledby="login-title">
        <div className="login-card">
          <div className="icon-tile"><LockKeyhole aria-hidden="true" /></div>
          <span className="eyebrow">ACCESO PRIVADO</span>
          <h1 id="login-title">Bienvenido a tus propiedades</h1>
          <p className="muted">Ingresa con tu cuenta autorizada.</p>
          {!configured && <div className="notice" id="configuration-notice" role="status">
            <strong>Estamos preparando tu espacio.</strong>
            El acceso estará disponible cuando finalice la configuración. Por ahora, no necesitas ingresar tus datos.
          </div>}
          <form onSubmit={submit} aria-busy={busy} aria-describedby={!configured ? 'configuration-notice' : undefined}>
            <fieldset disabled={!configured || busy}>
              <label htmlFor="email">Correo electrónico
                <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} autoCapitalize="none" spellCheck={false} />
              </label>
              <label htmlFor="password">Contraseña</label>
              <div className="password">
                <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} />
                <button type="button" className="icon-button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show}>
                  {show ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </fieldset>
            {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} attempt={challengeAttempt} onToken={setToken} />}
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={!configured || busy || !token || !turnstileSiteKey}>{busy ? 'Ingresando…' : 'Ingresar'}<ArrowRight size={18} aria-hidden="true" /></button>
          </form>
          <div className="secure-note"><ShieldCheck size={17} aria-hidden="true" />Acceso exclusivo para personas autorizadas.</div>
        </div>
        <footer className="mobile-copyright">© 2026. Jorkcáceres.</footer>
      </section>
    </main>
  );
}
