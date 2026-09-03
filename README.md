# Propiedades CM

**Versión:** 0.1.0

**Estado:** Desarrollo · base desplegable

## Propósito

Administrar viviendas arrendadas de la familia Cáceres Marzola, conservar la trazabilidad de pagos y emitir recibos verificables. Dominio previsto: https://propiedadescm.jorkcaceres.com.

Activo independiente del Portal Jorkcáceres. Se reutiliza conocimiento técnico y de experiencia de usuario, no su modelo de negocio ni sus módulos comerciales. Referencia: [Jorkcáceres OS 1.3.0](https://github.com/jorkcaceres/jorkcaceres-OS/tree/c0274d0cbd6a9a962c80c5a7cc71690aac84faa1).

## Alcance de esta entrega

- Next.js, React y TypeScript con versiones fijadas y lockfile.
- Pantalla de acceso con identidad Propiedades CM y diseño mobile first.
- Arranque de producción sin credenciales ni conexión con Supabase.
- Ingreso cerrado explícitamente, también en el servidor. No hay registro público.
- Base de permisos por módulos y acciones, con pruebas unitarias. No implica permisos operativos: falta implementar y probar la base de datos.
- No contiene personas, viviendas, usuarios ni recibos ficticios.

## Desplegar en Hostinger

| Opción | Valor |
|---|---|
| Repositorio | `jorkcaceres/propiedades-cm` |
| Rama | `main` |
| Framework | Next.js |
| Directorio raíz | `/` (raíz del repositorio, no una subcarpeta `propiedades-cm`) |
| Node.js | 22.x o 24.x |
| Instalación | `npm ci` |
| Compilación | `npm run build` |
| Inicio | `npm start` |
| Salida de compilación, si se solicita | `.next` |

El puerto lo proporciona el alojamiento mediante `PORT`; `next start` lo respeta. No usar una exportación estática ni la carpeta `dist`.

Esta entrega no requiere variables para mostrar el acceso. No introducir secretos para probar el despliegue inicial. `APP_URL` puede configurarse como `https://propiedadescm.jorkcaceres.com`.

## Desarrollo y validación

```sh
npm ci
npm test
npm run build
npm run typecheck
node scripts/smoke.mjs
npm start
```

Las pruebas de arranque no contactan Supabase. La validación en el dominio de Hostinger y en un iPhone real se realiza después del despliegue; no queda acreditada por una compilación local.

## Próxima entrega

1. Migraciones y políticas RLS; administrador inicial protegido; sesión y recuperación de acceso.
2. Gestión de familiares, invitaciones y permisos con comprobación en servidor y base de datos.
3. CRUD de viviendas, arrendadores y arrendatarios; vínculo de arrendamiento.
4. Pagos por concepto y periodo, recibos PNG, código aleatorio único y validación QR.
5. Historial, anulaciones y pruebas de integración con archivos privados.

Los contratos PDF con coarrendatarios pertenecen a una fase posterior. No activar `AUTH_READY` hasta tener la configuración y pruebas de seguridad completas. Las utilidades Supabase son preparación de código, no una integración operativa validada.

## Seguridad y operación

No almacenar secretos, datos personales, respaldos ni recibos en GitHub. `.env.example` solo documenta nombres para la configuración futura. Mantener claves privilegiadas únicamente en el servidor. El despliegue automático de `main` no aplica migraciones de base de datos.

## Historial

### 0.1.0

Base ejecutable para resolver la detección de la aplicación en Hostinger. Sin acceso operativo ni cambios en Supabase.
