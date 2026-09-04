# Propiedades CM

Versión 0.2.0 · Acceso privado con Supabase Auth.

Administración de viviendas arrendadas, trazabilidad de pagos y recibos verificables. Activo independiente del Portal Jorkcáceres: reutiliza conocimientos técnicos y de interfaz, no su modelo de negocio. Referencia: [Jorkcáceres OS](https://github.com/jorkcaceres/jorkcaceres-OS).

Dominio: https://propiedadescm.jorkcaceres.com.

## Alcance actual

- Acceso con correo, contraseña y Cloudflare Turnstile; validación del captcha a cargo de Supabase Auth.
- Solo ingresan cuentas confirmadas y miembros activos autorizados en la base de datos. Crear una cuenta en Auth no le concede acceso por sí solo.
- Sesiones en cookies HttpOnly, Secure en producción y SameSite=Lax. Comprobación de usuario y permisos en el servidor; respuestas privadas sin caché.
- Las cookies de una nueva sesión solo se envían tras comprobar la autorización. Si falla, se intenta revocar esa sesión y se descartan las cookies pendientes.
- Página privada con los datos de la cuenta y cierre de la sesión actual.
- Base de permisos por módulo/acción, RLS y auditoría en Supabase. Todavía no existe interfaz para administrar familiares o permisos.
- Diseño mobile first, identidad aprobada y ningún dato de negocio ficticio.

Pendientes: recuperación de contraseña desde la aplicación, gestión de usuarios, viviendas, arrendadores, arrendatarios, pagos y recibos PNG verificables. Contratos PDF en una fase posterior.

## Hostinger

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

La fuente de estas migraciones está en el historial remoto de Supabase; este repositorio todavía no incluye una copia SQL reproducible. El despliegue de GitHub no ejecuta migraciones.

Tablas públicas: `pcm_members`, `pcm_permission_catalog` y `pcm_audit_events`, todas con RLS. La configuración inicial está en un esquema privado sin acceso de clientes. El catálogo contiene 27 acciones. Los usuarios autenticados no tienen escritura directa sobre miembros, permisos o auditoría.

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

Las pruebas unitarias simulan el proveedor: cubren validación de entrada, token obligatorio, cuenta autorizada, rechazos, revocación solicitada y permisos. La prueba HTTP de producción arranca sin credenciales y comprueba acceso cerrado, redirecciones, cabeceras, recursos y protección de origen en el cierre de sesión. No acreditan un inicio de sesión real ni la validación real de Turnstile.

Para verificar la alternativa WASM con la versión fijada de Next.js puede ejecutarse `NEXT_TEST_WASM=1 npm run build`. Es una variable interna de prueba: no añadirla a Hostinger. No reproduce todo el sistema operativo del alojamiento.

Después del despliegue, comprobar manualmente: captcha, ingreso del administrador, datos de la cuenta, cierre de sesión y rechazo del panel tras salir; repetir en móvil y PC. Comprobar también una cuenta sin membresía activa. Nunca introducir datos de negocio ficticios en producción para estas pruebas.

`/api/health` informa versión y estado de habilitación; no comprueba disponibilidad de Supabase ni una sesión real.

## Identidad

Acceso con encabezado textual PROPIEDADES CM, sin apellidos ni ubicación; copyright `© 2026. Jorkcáceres.` y correo sin placeholder. Archivos suministrados en `public/brand`: `favicon.png`, `logo-white.png`, `logo-color.png`.

## Historial

- 0.2.0: integración de acceso/salida, autorización por membresía y captcha validado en Supabase.
- 0.1.0: base desplegable en Hostinger, pantalla de acceso e identidad visual.
