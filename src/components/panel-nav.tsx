'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function PanelNav({items}:{items:{href:string;label:string}[]}) {
  const path=usePathname();
  return <nav className="panel-nav" aria-label="Módulos">{items.map(item=><Link key={item.href} href={item.href} prefetch={false} aria-current={path===item.href||(item.href!=='/panel'&&path.startsWith(item.href+'/'))?'page':undefined}>{item.label}</Link>)}</nav>;
}
