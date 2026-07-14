# Política de seguridad — Nodora

## Estado

Nodora es software privado en desarrollo. El MVP funciona 100 % local, sin
red, sin cuentas y sin telemetría.

## Reportar una vulnerabilidad

Mientras el repositorio sea privado: abre un issue confidencial o contacta al
propietario del repositorio directamente. Incluye pasos de reproducción y
alcance. No publiques detalles antes de que exista corrección.

## Compromisos

- Consultas SQL parametrizadas en el 100 % del código.
- Validación y sanitización de todo contenido renderizado.
- Acceso al sistema de archivos restringido a directorios del workspace y
  rutas elegidas explícitamente por el usuario.
- Respaldos verificados con hashes antes de restaurar.
- Logs sin contenido de documentos del usuario.
- Dependencias auditadas en CI (`cargo audit`, `pnpm audit`).

Detalle técnico: `docs/SECURITY_ARCHITECTURE.md` y `docs/THREAT_MODEL.md`.
