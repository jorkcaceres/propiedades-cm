import { authEnabled } from '@/lib/release';
import { Login } from '@/components/login';
export const dynamic='force-dynamic';
export default function Page(){
  const ready=authEnabled();
  const turnstileSiteKey = ready ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '') : '';
  return <Login configured={ready} turnstileSiteKey={turnstileSiteKey}/>;
}
