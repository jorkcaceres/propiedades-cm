'use client';
import { useState } from 'react';

export function Logout() {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function logout() {
    if(busy) return;
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/auth/logout',{method:'POST'});
      if(!response.ok) throw Error('No pudimos cerrar la sesión. Intenta nuevamente.');
      // A full navigation drops the client-side page cache containing private data.
      window.location.replace('/login');
    } catch {setError('No pudimos cerrar la sesión. Intenta nuevamente.');setBusy(false);}
  }
  return <div><button type="button" className="turnstile-retry" disabled={busy} onClick={logout}>{busy?'Cerrando sesión…':'Cerrar sesión'}</button>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
