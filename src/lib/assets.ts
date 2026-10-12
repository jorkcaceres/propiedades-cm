import { z } from 'zod';

export const MAX_DOCUMENT_BYTES=20*1024*1024;
export const DOCUMENT_BUCKET='pcm-private-documents';
export type DocumentScope='property'|'lease';
export const isDocumentScope=(value:string):value is DocumentScope=>value==='property'||value==='lease';
export const documentConfig=(scope:DocumentScope)=>scope==='property'
  ?{table:'pcm_property_documents',entityColumn:'property_id',parentTable:'pcm_properties',parentPermission:'properties.view',permission:'property_documents',folder:'properties'} as const
  :{table:'pcm_lease_documents',entityColumn:'lease_id',parentTable:'pcm_leases',parentPermission:'leases.view',permission:'lease_documents',folder:'leases'} as const;

export const referenceInput=z.object({
  property_id:z.uuid(),identifier_type:z.string().trim().min(2).max(80),identifier:z.string().trim().min(1).max(150),
  company:z.string().trim().min(2).max(150),
}).strict();
export const referenceMutation=z.discriminatedUnion('action',[
  z.object({action:z.literal('edit'),id:z.uuid(),version:z.number().int().positive(),values:referenceInput.omit({property_id:true})}).strict(),
  z.object({action:z.literal('delete'),id:z.uuid(),version:z.number().int().positive()}).strict(),
]);
export const documentName=z.string().trim().min(2).max(150);
export const documentMutation=z.discriminatedUnion('action',[
  z.object({action:z.literal('rename'),id:z.uuid(),version:z.number().int().positive(),name:documentName}).strict(),
  z.object({action:z.literal('delete'),id:z.uuid(),version:z.number().int().positive()}).strict(),
]);

export type PropertyReference={id:string;property_id:string;identifier_type:string;identifier:string;company:string;version:number};
export type StoredDocument={id:string;name:string;original_name:string;size_bytes:number;version:number;created_at:string;property_id?:string;lease_id?:string};

export function safePdfName(name:string){return name.replace(/[\\/\0-\x1f\x7f]/g,'_').slice(0,255)||'documento.pdf';}
export function isPdf(bytes:Uint8Array){return bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';}
