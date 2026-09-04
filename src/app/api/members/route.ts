import { NextResponse } from 'next/server';
import { z } from 'zod';
import { access } from '@/lib/access';
import { body,failure,sameOrigin } from '@/lib/http';
import { databaseError } from '@/lib/database-errors';
import { allPermissions } from '@/lib/permissions';
const input=z.object({id:z.uuid().nullable(),email:z.email(),name:z.string().trim().min(2).max(150),active:z.boolean(),is_admin:z.boolean(),permissions:z.array(z.string().refine(p=>allPermissions.includes(p))).max(allPermissions.length),updated_at:z.iso.datetime({offset:true}).nullable()}).strict();
export async function POST(request:Request) {
  try {
    sameOrigin(request);const values=input.parse(await body(request));
    const {client}=await access(values.id?'users.manage':'users.invite');
    const {data,error}=await client.rpc('pcm_save_member',{
      target_id:values.id,target_email:values.email,target_name:values.name,target_active:values.active,
      target_admin:values.is_admin,target_permissions:[...new Set(values.permissions)],expected_updated_at:values.updated_at,
    });
    if(error) databaseError(error);
    return NextResponse.json({id:data},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return failure(error);}
}
