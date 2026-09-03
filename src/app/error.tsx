'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="status-page"><span className="eyebrow">PROPIEDADES CM</span><h1>No pudimos cargar la página.</h1><p className="muted">Intenta de nuevo en un momento.</p><button className="primary" onClick={reset}>Reintentar</button></main>;
}
