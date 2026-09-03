'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type WidgetSize = 'flexible' | 'compact';
type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string; action: string; theme: 'light'; language: 'es'; size: WidgetSize;
    'response-field': false;
    callback: (token: string) => void;
    'error-callback': () => void;
    'expired-callback': () => void;
    'timeout-callback': () => void;
  }) => string;
  remove: (widgetId: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

export function Turnstile({ siteKey, attempt, onToken }: {
  siteKey: string; attempt: number; onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState<WidgetSize | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    const measure = () => setSize(element.getBoundingClientRect().width < 300 ? 'compact' : 'flexible');
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const api = window.turnstile;
    if (!ready || !size || !container.current || !api) return;
    onToken('');
    setError('');
    let active = true;
    let id: string | undefined;
    const invalidate = (message: string) => {
      if (!active) return;
      onToken('');
      setError(message);
    };
    try {
      id = api.render(container.current, {
        sitekey: siteKey, action: 'login', theme: 'light', language: 'es', size,
        'response-field': false,
        callback: token => { if (active) { onToken(token); setError(''); } },
        'error-callback': () => invalidate('No pudimos completar la verificación. Intenta nuevamente.'),
        'expired-callback': () => invalidate('La verificación venció. Complétala nuevamente.'),
        'timeout-callback': () => invalidate('La verificación agotó su tiempo. Intenta nuevamente.'),
      });
    } catch { invalidate('No pudimos cargar la verificación. Intenta nuevamente.'); }
    return () => {
      active = false;
      onToken('');
      if (id !== undefined) api.remove(id);
    };
  }, [ready, size, siteKey, attempt, retry, onToken]);

  return <div className="turnstile-block">
    <Script id="cloudflare-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive" onReady={() => setReady(true)}
      onError={() => { onToken(''); setError('No pudimos cargar Cloudflare. Revisa tu conexión y recarga la página.'); }} />
    <div ref={container} className="turnstile-container" aria-label="Verificación de seguridad de Cloudflare" />
    {!ready && !error && <p className="small muted" role="status">Cargando verificación de seguridad…</p>}
    {error && <div role="alert"><p className="small error">{error}</p>
      <button type="button" className="turnstile-retry" onClick={() => {
        if (!ready) window.location.reload();
        else setRetry(value => value + 1);
      }}>Reintentar verificación</button>
    </div>}
  </div>;
}
