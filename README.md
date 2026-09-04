# Propiedades CM

Versión 0.3.0 · Acceso privado y módulos administrativos.

Administración de viviendas arrendadas, trazabilidad de pagos y recibos verificables. Activo independiente del Portal Jorkcáceres: reutiliza conocimientos técnicos y de interfaz, no su modelo de negocio. Referencia: [Jorkcáceres OS](https://github.com/jorkcaceres/jorkcaceres-OS).

Dominio: https://propiedadescm.jorkcaceres.com.

## Alcance actual

- Acceso con correo, contraseña y Cloudflare Turnstile; validación del captcha a cargo de Supabase Auth.
- Solo ingresan cuentas confirmadas y miembros activos autorizados en la base de datos. Crear una cuenta en Auth no le concede acceso por sí solo.
- Sesiones en cookies HttpOnly, Secure en producción y SameSite=Lax. Comprobación de usuario y permisos en el servidor; respuestas privadas sin caché.
- Las cookies de una nueva sesión solo se envían tras comprobar la autorización. Si falla, se intenta revocar esa sesión y se descartan las cookies pendientes.
- Inicio privado, navegación según permisos y cierre de sesión.
- Arrendadores, arrendatarios y viviendas: crear, consultar, buscar por nombre, editar, inactivar y reactivar. Listas paginadas y control de versión para detectar ediciones simultáneas. No se eliminan datos físicamente.
- Usuarios: autorizar una cuenta ya creada y confirmada en Supabase Auth, asignar permisos y activar/suspender accesos. No se envían invitaciones ni se crean contraseñas desde la aplicación en esta entrega.
- La administración delegada no permite conceder capacidades superiores a las propias ni modificar administradores. Nadie puede cambiar su propio acceso desde este módulo.
- Actividad: consulta de los últimos 50 eventos, con referencia al registro y al responsable. Auditoría almacenada en Supabase.
- Diseño mobile first, identidad aprobada y ningún dato de negocio ficticio.

Pendientes: invitaciones y recuperación de contraseña desde la aplicación, arrendamientos, pagos y recibos PNG verificables. Contratos PDF en una fase posterior. El canon y la relación con el arrendatario se asociarán al arrendamiento, no a un campo mutable de la vivienda.

## Hostinger

### Entregas agrupadas

- `develop`: trabajo habitual y ajustes en curso. No conectar esta rama al dominio de producción.
- `main`: entregas completas, verificadas y listas para publicar. Mantener Hostinger conectado únicamente a esta rama.
- Guardar avances en `develop` no publica cambios en el dominio. Integrar el conjunto en `main` una sola vez por entrega.
- Durante el trabajo, usar `npm run check` para tipos y pruebas, sin compilar la aplicación. Antes de publicar código, usar `npm run verify:release`: pruebas, una compilación y comprobación HTTP de producción. La compilación ya valida TypeScript.
- Cambios únicamente de documentación: comprobar diferencias, guardarlos en `develop` y agruparlos con la próxima entrega; no compilar ni actualizar `main` solo por ellos.
- No borrar cachés ni reinstalar dependencias si el lockfile no cambia. No añadir otro mecanismo de despliegue que duplique el de Hostinger.

Esta separación reduce la cantidad de despliegues, no promete que cada compilación de Hostinger tarde menos. No se ha configurado una regla de protección obligatoria para `main`: es el flujo de trabajo del proyecto. Los filtros de GitHub Actions y mensajes `[skip ci]` no controlan el webhook independiente de Hostinger.

Hostinger despliega los cambios de la rama conectada: [documentación oficial](https://www.hostinger.com/support/how-to-deploy-apps-built-with-codex-on-hostinger/). Verificar en su panel que la rama siga siendo `main`; no hace falta cambiar claves ni crear otro alojamiento.

| Opción | Valor |
|---|---|
| Repositorio / rama | `jorkcaceres/propiedades-cm` / `main` |
| Framework / raíz | Next.js / `/` |
| Node.js | 22.x o 24.x |
| Instalación | `npm ci` |
| Compilación | `npm run build` |
| Inicio | `npm start` |
| Salida, si se solicita | `.next` |

El alojamiento proporciona `PORT`. No es una exportación estática ni utiliza `dist`.

Se conservan `next.config.mjs` y `next build --webpack`: el entorno de Hostinger reportó una GLIBC incompatible con SWC nativo. Webpack permite la alternativa WASM de Next.js; el entorno debe permitir descargarla. No cambiar a Turbopack ni atribuir ese error exclusivamente a Node.

### Variables de la aplicación

Configurar antes de compilar y mantener disponibles en ejecución:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública publishable del proyecto |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clave pública del widget de Cloudflare |
| `APP_URL` | `https://propiedadescm.jorkcaceres.com` |
| `PCM_AUTH_ENABLED` | `true`, únicamente después de completar la protección en Supabase |

Sin la habilitación explícita o la configuración pública completa, el acceso permanece cerrado. Los cambios en variables `NEXT_PUBLIC_` requieren recompilación y despliegue. Los cambios en los datos o permisos de Supabase no requieren desplegar código.

La clave privilegiada `SUPABASE_SECRET_KEY` no es necesaria para este inicio de sesión. No añadirla para resolver problemas de acceso. Nunca compartir claves secretas ni contraseñas en el repositorio.

### Supabase Auth y Turnstile

1. En Cloudflare, crear un widget Turnstile Managed y autorizar el hostname `propiedadescm.jorkcaceres.com`. No usar claves de prueba en producción.
2. En Supabase Auth, activar protección CAPTCHA, seleccionar Turnstile y guardar allí la clave secreta del mismo widget. No se necesita `TURNSTILE_SECRET_KEY` en Hostinger.
3. Desactivar nuevos registros públicos y acceso anónimo. Esta aplicación no contiene registro público, pero también debe bloquearse en la configuración del proveedor.
4. Configurar Site URL con el dominio HTTPS de la aplicación. No añadir comodines amplios a las URLs permitidas.
5. Confirmar que la cuenta administradora existe en Auth y tiene una membresía activa autorizada. No conceder permisos mediante `user_metadata`.
6. Configurar las variables de Hostinger, activar `PCM_AUTH_ENABLED=true` y desplegar.

El token del widget se envía como `captchaToken` a `signInWithPassword`. Supabase realiza la validación del captcha: no llamar adicionalmente a Siteverify, porque el token es de un solo uso. El widget se adapta al ancho disponible y se reinicia tras un intento, error o expiración.

La presencia de variables en Hostinger no demuestra que la protección CAPTCHA esté habilitada en Supabase. Esa configuración y la prueba real del dominio son pasos obligatorios de puesta en marcha.

Referencias: [CAPTCHA en Supabase Auth](https://supabase.com/docs/guides/auth/auth-captcha) y [signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

## Base de acceso en Supabase

Aplicada mediante el conector autorizado, sin ejecutar la CLI de Supabase:

- `20260904000942_pcm_access_foundation`
- `20260904001113_pcm_explicit_deny_admin_setup`
- `20260904010758_pcm_administrative_modules`

Las dos migraciones iniciales se conservan en el historial remoto. El SQL de la tercera está en `database/administrative_modules.sql` y depende de esa base previa; no es un instalador independiente. El despliegue de GitHub no ejecuta migraciones. Las funciones de acceso copiadas en `tests/fixtures` son soporte de pruebas, no una migración alternativa.

Tablas públicas: `pcm_members`, `pcm_permission_catalog`, `pcm_audit_events`, `pcm_landlords`, `pcm_tenants` y `pcm_properties`, todas con RLS. La configuración inicial está en un esquema privado sin acceso de clientes. El catálogo contiene 27 acciones. Los usuarios autenticados no tienen escritura directa sobre miembros, permisos o auditoría. Los nuevos registros se operan bajo políticas por módulo y acción; triggers distinguen editar de cambiar estado.

La autorización exige miembro activo, usuario confirmado no anónimo ni bloqueado y una sesión existente en Supabase asociada al JWT. Una cuenta suspendida pierde acceso en la siguiente comprobación. El último administrador activo está protegido frente a desactivación; la auditoría no permite modificaciones ni borrados ordinarios.

Antes de ampliar módulos, conservar estas restricciones y añadir pruebas de permisos. La interfaz no es una frontera de seguridad.

## Validación

```sh
npm ci
npm test
npm run build
npm run typecheck
node scripts/smoke.mjs
```

Las pruebas de autenticación simulan el proveedor. Las pruebas SQL ejecutan el esquema en PGlite con identidades/sesiones locales aisladas; comprueban RLS, permisos, auditoría y restricciones de actualización. Nunca insertan personas ficticias en producción. La prueba HTTP arranca sin credenciales y comprueba acceso cerrado en todos los módulos, redirecciones, cabeceras, recursos y protección de origen. No sustituyen la prueba real de ingreso ni el recorrido de formularios en móvil y PC.

Para verificar la alternativa WASM con la versión fijada de Next.js puede ejecutarse `NEXT_TEST_WASM=1 npm run build`. Es una variable interna de prueba: no añadirla a Hostinger. No reproduce todo el sistema operativo del alojamiento.

Después del despliegue, comprobar manualmente: captcha, ingreso del administrador, datos de la cuenta, cierre de sesión y rechazo del panel tras salir; repetir en móvil y PC. Comprobar también una cuenta sin membresía activa. Nunca introducir datos de negocio ficticios en producción para estas pruebas.

`/api/health` informa versión y estado de habilitación; no comprueba disponibilidad de Supabase ni una sesión real.

## Identidad

Logo blanco suministrado en acceso y panel privado, completo y sin modificar, con soporte oscuro para contraste. Se mantiene el amarillo del acceso, el copyright `© 2026. Jorkcáceres.` y el correo sin placeholder. Archivos en `public/brand`: `favicon.png`, `logo-white.png`, `logo-color.png`.

## Historial

- 0.3.0: ambos logos, módulos administrativos, auditoría de registros y flujo de entregas agrupadas con `develop`/`main`.
- 0.2.0: integración de acceso/salida, autorización por membresía y captcha validado en Supabase.
- 0.1.0: base desplegable en Hostinger, pantalla de acceso e identidad visual.
