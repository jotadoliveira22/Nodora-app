-- 002_page_cover.sql — Portada de página (docs/UX_IMPROVEMENTS_PLAN.md §3)
--
-- Aditiva y con valores nulos: una base v1 se migra sin pérdida y las páginas
-- existentes se quedan sin portada, que es el estado correcto.
--
-- La portada es un atributo de la página, no contenido. Como bloque
-- contaminaría las exportaciones, la búsqueda y los backlinks; dentro de un
-- JSON opaco no se podría consultar ni migrar con garantías.
--
--   cover_kind  NULL | 'color' | 'attachment'
--   cover_value id del preset de color, o id de la fila de attachments
--
-- La integridad de la pareja se valida en el dominio (pages::set_page_cover):
-- un CHECK aquí obligaría a reescribir la tabla en cada cambio futuro de los
-- tipos admitidos, y SQLite no permite añadirlo con ALTER TABLE.

ALTER TABLE pages ADD COLUMN cover_kind TEXT;
ALTER TABLE pages ADD COLUMN cover_value TEXT;
