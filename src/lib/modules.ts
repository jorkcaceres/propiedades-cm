import { z } from 'zod';
export const modules = {
  landlords:{label:'Arrendadores',singular:'arrendador',description:'Personas que figuran como arrendadoras de las viviendas.'},
  tenants:{label:'Arrendatarios',singular:'arrendatario',description:'Personas que toman una vivienda en arrendamiento.'},
  properties:{label:'Viviendas',singular:'vivienda',description:'Inmuebles y sus características. El canon y sus periodos se definen en el arrendamiento.'},
} as const;
export type ModuleKey=keyof typeof modules;
export function isModule(value:string):value is ModuleKey {return Object.hasOwn(modules,value);}
const optionalText=(max:number)=>z.string().trim().max(max).default('');
const personInput=z.object({
  name:z.string().trim().min(2).max(150),document_type:z.enum(['CC','CE','NIT','PAS','OTRO']),
  document_number:z.string().trim().regex(/^[A-Za-z0-9-]{3,30}$/).transform(v=>v.toUpperCase()),
  email:z.union([z.literal(''),z.email()]).default(''),phone:optionalText(30),address:optionalText(250),notes:optionalText(2000),
}).strict();
const nullableNumber=(max:number,integer=false)=>z.preprocess(v=>v===''||v===undefined?null:v,
  (integer?z.coerce.number().int():z.coerce.number()).min(integer?0:0.01).max(max).nullable());
const propertyInput=z.object({
  name:z.string().trim().min(2).max(150),address:z.string().trim().min(3).max(250),
  neighborhood:optionalText(100),city:z.string().trim().min(2).max(100),department:z.string().trim().min(2).max(100),
  property_type:z.enum(['casa','apartamento','habitacion','otro']),landlord_id:z.uuid(),
  bedrooms:nullableNumber(99,true),bathrooms:nullableNumber(99,true),area_m2:nullableNumber(99999999.99),notes:optionalText(2000),
}).strict();
export function recordInput(module:ModuleKey,input:unknown):Record<string,string|number|null> {return (module==='properties'?propertyInput:personInput).parse(input);}
export const recordMutation=z.discriminatedUnion('action',[
  z.object({action:z.literal('edit'),id:z.uuid(),version:z.number().int().positive(),values:z.record(z.string(),z.unknown())}).strict(),
  z.object({action:z.literal('archive'),id:z.uuid(),version:z.number().int().positive(),active:z.boolean()}).strict(),
]);
export type DataRecord={id:string;name:string;active:boolean;version:number;[key:string]:string|number|boolean|null};
