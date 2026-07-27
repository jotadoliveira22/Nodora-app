# TECHNICAL_DEBT.md — Deuda técnica conocida

> Registro explícito exigido por `docs/NODORA_SPEC.md` §15 («informa cualquier
> deuda técnica introducida»). Cada entrada indica el impacto real, por qué se
> aceptó y cómo se saldaría.

## D1 — Los adjuntos no se liberan al eliminar contenido

- **Qué pasa:** `attachments.ref_count` se incrementa al insertar una imagen y
  al duplicar una página, pero no se decrementa al borrar el bloque de imagen
  ni al eliminar definitivamente una página. Los archivos quedan en
  `attachments/` indefinidamente.
- **Impacto:** el workspace crece con imágenes ya no referenciadas. No hay
  corrupción ni pérdida de datos; los respaldos incluyen esos archivos.
- **Por qué se aceptó:** eliminar un archivo por error es peor que conservar
  uno de más; una recolección segura exige recorrer todos los documentos.
- **Cómo se salda:** una operación de mantenimiento («Liberar espacio») que
  recorra `content_json` de todas las páginas vivas, recalcule las referencias
  reales y borre los archivos sin referencias, previo respaldo. V2.

## D2 — Los títulos mostrados en enlaces internos no se refrescan en vivo

- **Qué pasa:** los nodos `pageLink` y `subpage` renderizan el título de la
  página destino en el momento de crear el editor. Si se renombra esa página
  mientras la página que la enlaza está abierta, el enlace sigue mostrando el
  nombre anterior hasta navegar fuera y volver.
- **Impacto:** cosmético. El enlace apunta al identificador, así que navega
  correctamente en todo momento.
- **Por qué se aceptó:** re-renderizar los NodeViews ante cualquier cambio del
  árbol obligaría a recrear el editor o a un canal de invalidación; ninguna de
  las dos cosa aporta al MVP.
- **Cómo se salda:** un decorador de ProseMirror que observe el mapa de
  títulos y actualice solo los nodos afectados. V2.

## D3 — Un documento que supera el tamaño máximo falla con un mensaje genérico

- **Qué pasa:** el backend rechaza documentos de más de 8 MB
  (`INVALID_DOCUMENT`). La interfaz muestra el error y reintenta, pero no
  explica que el problema es el tamaño ni ofrece una salida.
- **Impacto:** muy improbable con uso normal (8 MB de JSON son decenas de
  miles de bloques). El trabajo no se pierde: sigue en pantalla.
- **Cómo se salda:** mensaje específico para ese código y sugerencia de
  dividir la página. V2.

## D4 — El instalador de Windows no está firmado

- **Qué pasa:** SmartScreen advertirá al instalar.
- **Por qué se aceptó:** un certificado OV/EV cuesta 200–400 €/año y el MVP es
  de uso privado (ver `docs/COST_ESTIMATE.md`).
- **Cómo se salda:** comprar certificado y firmar en el job de release.

## D5 — Sin auto-actualización

- **Qué pasa:** actualizar exige descargar e instalar manualmente.
- **Por qué se aceptó:** el updater de Tauri necesita infraestructura de
  distribución y claves de firma, contrarias al alcance «sin servidor» del
  MVP.
- **Cómo se salda:** activar el updater de Tauri cuando exista distribución.

## D6 — Las pruebas de interfaz usan un backend en memoria

- **Qué pasa:** `apps/desktop/e2e/fakeBackend.js` reimplementa la frontera IPC
  para las pruebas de UI. Si se añade un comando y no se añade allí, la prueba
  falla con «comando no implementado».
- **Impacto:** riesgo de divergencia entre lo simulado y el backend real.
- **Mitigación vigente:** la prueba `ipc_dtos_serialize_in_camel_case` fija las
  formas de los DTO del lado Rust, y las pruebas de persistencia reales viven
  en `cargo test`. Ver ADR-010.
- **Cómo se salda:** generar los tipos de la frontera IPC desde Rust (por
  ejemplo con `ts-rs`) para que el desajuste rompa la compilación.
