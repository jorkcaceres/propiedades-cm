import { HttpError } from './errors';
export function databaseError(error:{code?:string;message?:string}):never {
  if(error.code==='42501') throw new HttpError('No tienes permiso para realizar esta acción.',403);
  if(error.code==='23505') throw new HttpError('Ya existe un registro con ese documento o correo. Revisa también los inactivos.',409);
  if(error.code==='23503') throw new HttpError('El registro relacionado no está disponible.',409);
  if(error.code==='23514') throw new HttpError('Revisa los datos y los registros relacionados. La operación no cumple las reglas del módulo.',400);
  if(error.code==='P0001') {
    const allowed=['Primero crea y confirma esta cuenta en Supabase Auth.','El usuario cambió. Actualiza la lista antes de guardar.','No puedes modificar tus propios permisos o estado.'];
    if(error.message&&allowed.includes(error.message)) throw new HttpError(error.message,409);
  }
  throw new HttpError('No fue posible guardar los cambios. Intenta nuevamente.',503);
}
