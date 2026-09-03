import { configured } from '@/lib/supabase';
import { AUTH_READY } from '@/lib/release';
import { Login } from '@/components/login';
export const dynamic='force-dynamic';
export default function Page(){return <Login configured={AUTH_READY && configured()}/>;}
