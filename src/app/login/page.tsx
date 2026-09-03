import { configured } from '@/lib/supabase';
import { AUTH_READY } from '@/lib/release';
import { Login } from '@/components/login';
export const dynamic='force-dynamic';
export default function Page(){
  const turnstileSiteKey = process.env.TURNSTILE_SECRET_KEY ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '') : '';
  return <Login configured={AUTH_READY && configured() && Boolean(turnstileSiteKey)} turnstileSiteKey={turnstileSiteKey}/>;
}
