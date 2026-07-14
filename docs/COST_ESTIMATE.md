# COST_ESTIMATE.md — Estimación de costes

## MVP (hoy)

| Concepto | Coste |
|---|---|
| Ejecución de la app | 0 € (local) |
| Distribución | 0 € (instalador compartido en privado) |
| CI GitHub Actions | Gratis en repos privados hasta la cuota mensual; el build Windows consume ~10–15 min/release (multiplicador x2 de minutos en runner Windows) |
| Firma de código Windows (opcional, evita aviso SmartScreen) | ~200–400 €/año (certificado OV/EV) — aplazado |

## Self-hosted (Horizonte 2, estimación 2026)

| Escenario | Hardware/servicio | Coste aproximado |
|---|---|---|
| Servidor doméstico / NAS | Hardware ya existente | 0 €/mes + electricidad |
| VPS pequeño (1 usuario, 2-3 dispositivos) | 2 vCPU / 4 GB (Hetzner/Contabo/OVH gama baja) | ~5–10 €/mes |
| VPS equipo pequeño (≤10 usuarios) | 4 vCPU / 8 GB + backups | ~15–30 €/mes |

## Nube managed (Horizonte 4, equipo)

| Componente | Estimación mensual (equipo ≤10) |
|---|---|
| Contenedores (API+WS) | 20–50 € |
| PostgreSQL gestionado | 15–60 € |
| S3 (50 GB + tráfico moderado) | 3–10 € |
| Total orientativo | **~40–120 €/mes** |

> Estimaciones orientativas a precios públicos de 2026, para dimensionar
> decisiones; deberán revisarse al iniciar cada horizonte. El diseño
> (Compose, S3-compatible, PostgreSQL estándar) evita lock-in de proveedor,
> así que el coste es negociable por diseño.
