# Propiedades CM — reglas de trabajo

## Alcance e infraestructura

- Activo independiente de los otros proyectos Jorkcáceres. Reutilizar aprendizajes técnicos, no sus modelos de negocio.
- Conservar Next.js, Supabase y Hostinger. No registrar ni desplegar este proyecto en otro alojamiento.
- Mantener `next.config.mjs` y `next build --webpack`: Hostinger necesita compatibilidad con SWC WASM.
- Supabase se administra únicamente mediante el conector autorizado; no ejecutar la CLI local.
- No guardar secretos, datos personales ni recibos en el repositorio.

## Reducir despliegues

- Trabajar y guardar avances en `develop`, o una rama de tarea derivada de ella.
- `main` es exclusivamente la rama de publicación conectada a Hostinger.
- Agrupar cambios en entregas completas. No actualizar `main` por cada ajuste, commit intermedio o cambio de documentación.
- Publicar en `main` cuando se solicite una entrega al dominio; en trabajo intermedio, dejar cambios guardados en `develop` y comunicar que aún no están publicados.
- Antes de publicar, revisar diferencias y divergencias remotas. Conservar cambios ajenos, nunca forzar referencias ni sobrescribir trabajo.
- Ejecutar `npm run check` durante desarrollo cuando sea relevante. Para una entrega de código, ejecutar `npm run verify:release` una vez al finalizar y corregir errores reales antes de publicar. No duplicar la compilación salvo que cambie el código o falle.
- Para documentación aislada, revisar el diff sin compilar. Mantenerla en `develop` hasta la siguiente entrega.
- Conservar dependencias y cachés; reinstalar únicamente cuando sea necesario. No crear despliegues paralelos con GitHub Actions ni asumir que `[skip ci]` detiene Hostinger.
- No confundir estas reglas con protección obligatoria de ramas: esa protección debe configurarse explícitamente en GitHub si se solicita.

## Interfaz y seguridad

- Mobile first; conservar el diseño aprobado. Logo blanco suministrado en el acceso y panel privado, con soporte oscuro para contraste.
- No modificar ni recrear los logos suministrados para ajustes de interfaz.
- No reducir validación de sesiones, RLS, autorización o captcha para acelerar desarrollo o despliegues.
- No inventar datos de negocio ni afirmar pruebas reales que no se hayan ejecutado.
