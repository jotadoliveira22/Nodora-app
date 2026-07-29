/**
 * Catálogo de plantillas de Nodora (docs/UX_IMPROVEMENTS_PLAN.md §1.4).
 *
 * Las plantillas son **datos, no código**: cada una declara su título, icono,
 * bloques iniciales y, si procede, la base de datos que crea con sus
 * propiedades. Añadir una plantilla nueva no toca ningún componente ni ningún
 * comando, y todas quedan cubiertas por la misma prueba parametrizada.
 *
 * Los contenidos son originales, escritos para Nodora. No proceden de ninguna
 * herramienta de terceros.
 */
import type { PropertyType } from './types';

/** Bloque en la notación breve de autoría; se compila a ProseMirror. */
export type TemplateBlock =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'tasks'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'callout'; text: string }
  | { kind: 'code'; text: string; language?: string }
  | { kind: 'divider' };

export interface TemplateSelectOption {
  name: string;
  color?: string;
}

export interface TemplateProperty {
  name: string;
  type: Exclude<PropertyType, 'title'>;
  options?: TemplateSelectOption[];
}

export type TemplateGroup = 'consultora' | 'proyecto' | 'notas' | 'personal' | 'otras';

export interface NodoraTemplate {
  id: string;
  name: string;
  icon: string;
  group: TemplateGroup;
  /** Una línea que explica para qué sirve, visible en el selector. */
  summary: string;
  /** Título con el que se crea la página. */
  title: string;
  blocks: TemplateBlock[];
  /** Presente si la plantilla crea una base de datos en vez de una página. */
  database?: { properties: TemplateProperty[] };
  /**
   * Advertencia mostrada al elegirla, cuando la aplicación todavía no cubre
   * del todo lo que el nombre sugiere. Preferimos decirlo antes que dejar que
   * el usuario lo descubra usándola.
   */
  caveat?: string;
}

export const TEMPLATE_GROUPS: { id: TemplateGroup; label: string }[] = [
  { id: 'consultora', label: 'Consultora y clientes' },
  { id: 'proyecto', label: 'Proyectos' },
  { id: 'notas', label: 'Notas y conocimiento' },
  { id: 'personal', label: 'Personal' },
  { id: 'otras', label: 'Otras' },
];

const ESTADO_TAREA: TemplateSelectOption[] = [
  { name: 'Sin empezar', color: 'gray' },
  { name: 'En curso', color: 'blue' },
  { name: 'Bloqueada', color: 'red' },
  { name: 'Terminada', color: 'green' },
];

const PRIORIDAD: TemplateSelectOption[] = [
  { name: 'Alta', color: 'red' },
  { name: 'Media', color: 'yellow' },
  { name: 'Baja', color: 'gray' },
];

export const TEMPLATES: NodoraTemplate[] = [
  // ---- Consultora y clientes ----------------------------------------------
  {
    id: 'ficha-cliente',
    name: 'Ficha de cliente',
    icon: '🏢',
    group: 'consultora',
    summary: 'Datos, contactos, contexto y estado de la relación.',
    title: 'Cliente: ',
    blocks: [
      { kind: 'callout', text: 'Rellena los datos y enlaza aquí las propuestas y actas con @.' },
      { kind: 'h', level: 2, text: 'Datos' },
      {
        kind: 'bullets',
        items: ['Razón social:', 'Sector:', 'Web:', 'Cómo llegó a nosotros:', 'Cliente desde:'],
      },
      { kind: 'h', level: 2, text: 'Contactos' },
      { kind: 'bullets', items: ['Nombre — cargo — correo — teléfono'] },
      { kind: 'h', level: 2, text: 'Contexto y objetivos' },
      { kind: 'p', text: 'Qué necesita, qué ha probado antes y qué considera un éxito.' },
      { kind: 'h', level: 2, text: 'Servicios contratados' },
      { kind: 'bullets', items: ['Servicio — alcance — importe — periodo'] },
      { kind: 'h', level: 2, text: 'Historial' },
      { kind: 'p', text: 'Enlaza aquí las actas de reunión y las propuestas.' },
    ],
  },
  {
    id: 'propuesta-comercial',
    name: 'Propuesta comercial',
    icon: '📄',
    group: 'consultora',
    summary: 'Contexto, alcance, precio y condiciones, listo para enviar.',
    title: 'Propuesta — ',
    blocks: [
      { kind: 'h', level: 2, text: 'El problema' },
      { kind: 'p', text: 'En sus palabras: qué le duele hoy y qué cuesta no resolverlo.' },
      { kind: 'h', level: 2, text: 'Lo que proponemos' },
      { kind: 'p', text: 'La solución en tres frases, sin jerga.' },
      { kind: 'h', level: 2, text: 'Alcance' },
      { kind: 'bullets', items: ['Incluye:', 'No incluye:'] },
      { kind: 'h', level: 2, text: 'Plan de trabajo' },
      { kind: 'bullets', items: ['Fase 1 — entregable — plazo', 'Fase 2 — entregable — plazo'] },
      { kind: 'h', level: 2, text: 'Inversión' },
      { kind: 'bullets', items: ['Concepto — importe', 'Forma de pago:', 'Validez de la oferta:'] },
      { kind: 'h', level: 2, text: 'Condiciones' },
      {
        kind: 'bullets',
        items: ['Plazo de entrega', 'Revisiones incluidas', 'Propiedad del trabajo'],
      },
      { kind: 'divider' },
      {
        kind: 'p',
        text: 'Siguiente paso: confirmar por escrito y agendar la reunión de arranque.',
      },
    ],
  },
  {
    id: 'acta-reunion',
    name: 'Acta de reunión',
    icon: '📝',
    group: 'consultora',
    summary: 'Asistentes, temas, acuerdos y responsables.',
    title: 'Acta — ',
    blocks: [
      { kind: 'bullets', items: ['Fecha:', 'Asistentes:', 'Convoca:'] },
      { kind: 'h', level: 2, text: 'Objetivo de la reunión' },
      { kind: 'p', text: '' },
      { kind: 'h', level: 2, text: 'Temas tratados' },
      { kind: 'bullets', items: [''] },
      { kind: 'h', level: 2, text: 'Acuerdos' },
      { kind: 'bullets', items: [''] },
      { kind: 'h', level: 2, text: 'Próximos pasos' },
      { kind: 'tasks', items: ['Qué — quién — cuándo'] },
      { kind: 'h', level: 2, text: 'Temas abiertos' },
      { kind: 'bullets', items: [''] },
    ],
  },

  // ---- Proyectos -----------------------------------------------------------
  {
    id: 'proyecto',
    name: 'Página de proyecto',
    icon: '🚀',
    group: 'proyecto',
    summary: 'Objetivo, alcance, hitos, riesgos y decisiones.',
    title: 'Proyecto: ',
    blocks: [
      { kind: 'callout', text: 'Crea al lado la plantilla «Tareas de proyecto» y enlázala con @.' },
      { kind: 'h', level: 2, text: 'Objetivo' },
      { kind: 'p', text: 'Qué cambia cuando esto esté terminado.' },
      { kind: 'h', level: 2, text: 'Alcance' },
      { kind: 'bullets', items: ['Dentro:', 'Fuera:'] },
      { kind: 'h', level: 2, text: 'Hitos' },
      { kind: 'tasks', items: ['Hito 1 — fecha', 'Hito 2 — fecha'] },
      { kind: 'h', level: 2, text: 'Equipo' },
      { kind: 'bullets', items: ['Responsable:', 'Participantes:'] },
      { kind: 'h', level: 2, text: 'Riesgos' },
      { kind: 'bullets', items: ['Riesgo — impacto — cómo lo mitigamos'] },
      { kind: 'h', level: 2, text: 'Decisiones tomadas' },
      { kind: 'bullets', items: ['Fecha — decisión — por qué'] },
    ],
  },
  {
    id: 'tareas-proyecto',
    name: 'Tareas de proyecto',
    icon: '✅',
    group: 'proyecto',
    summary: 'Base de datos con estado, prioridad, responsable y fecha.',
    title: 'Tareas',
    blocks: [],
    database: {
      properties: [
        { name: 'Estado', type: 'status', options: ESTADO_TAREA },
        { name: 'Prioridad', type: 'select', options: PRIORIDAD },
        { name: 'Responsable', type: 'text' },
        { name: 'Fecha límite', type: 'date' },
        { name: 'Notas', type: 'text' },
      ],
    },
  },

  // ---- Notas y conocimiento ------------------------------------------------
  {
    id: 'nota-diaria',
    name: 'Nota diaria',
    icon: '📅',
    group: 'notas',
    summary: 'Prioridades del día, notas sueltas y cierre.',
    title: 'Nota del día',
    blocks: [
      { kind: 'h', level: 2, text: 'Las tres de hoy' },
      { kind: 'tasks', items: ['', '', ''] },
      { kind: 'h', level: 2, text: 'Notas' },
      { kind: 'p', text: '' },
      { kind: 'h', level: 2, text: 'Ha surgido' },
      { kind: 'bullets', items: [''] },
      { kind: 'h', level: 2, text: 'Cierre del día' },
      { kind: 'bullets', items: ['Qué salió bien:', 'Qué dejo para mañana:'] },
    ],
  },
  {
    id: 'documento-tecnico',
    name: 'Documento técnico',
    icon: '📐',
    group: 'notas',
    summary: 'Problema, opciones, decisión y consecuencias.',
    title: 'Documento técnico: ',
    blocks: [
      { kind: 'bullets', items: ['Estado: borrador', 'Autor:', 'Fecha:'] },
      { kind: 'h', level: 2, text: 'Contexto' },
      { kind: 'p', text: 'Qué problema hay que resolver y por qué ahora.' },
      { kind: 'h', level: 2, text: 'Opciones consideradas' },
      {
        kind: 'bullets',
        items: ['Opción A — a favor / en contra', 'Opción B — a favor / en contra'],
      },
      { kind: 'h', level: 2, text: 'Decisión' },
      { kind: 'p', text: 'Qué se elige y por qué.' },
      { kind: 'h', level: 2, text: 'Consecuencias' },
      { kind: 'bullets', items: ['Lo que gana:', 'Lo que cuesta:', 'Difícil de revertir:'] },
      { kind: 'h', level: 2, text: 'Detalle' },
      { kind: 'code', text: '', language: 'text' },
    ],
  },
  {
    id: 'indice-wiki',
    name: 'Índice de conocimiento',
    icon: '🗂️',
    group: 'notas',
    summary: 'Página madre para organizar un área con subpáginas.',
    title: 'Índice: ',
    blocks: [
      { kind: 'p', text: 'De qué trata esta área y quién la mantiene.' },
      { kind: 'h', level: 2, text: 'Empezar por aquí' },
      { kind: 'bullets', items: ['Enlaza con @ las páginas de entrada.'] },
      { kind: 'h', level: 2, text: 'Procedimientos' },
      { kind: 'bullets', items: [''] },
      { kind: 'h', level: 2, text: 'Referencias' },
      { kind: 'bullets', items: [''] },
      { kind: 'h', level: 2, text: 'Pendiente de escribir' },
      { kind: 'tasks', items: [''] },
    ],
  },

  // ---- Personal ------------------------------------------------------------
  {
    id: 'semana',
    name: 'Plan semanal',
    icon: '🗓️',
    group: 'personal',
    summary: 'Prioridades de la semana y reparto por día.',
    title: 'Semana del ',
    blocks: [
      { kind: 'h', level: 2, text: 'Prioridades de la semana' },
      { kind: 'tasks', items: ['', '', ''] },
      { kind: 'h', level: 2, text: 'Lunes' },
      { kind: 'tasks', items: [''] },
      { kind: 'h', level: 2, text: 'Martes' },
      { kind: 'tasks', items: [''] },
      { kind: 'h', level: 2, text: 'Miércoles' },
      { kind: 'tasks', items: [''] },
      { kind: 'h', level: 2, text: 'Jueves' },
      { kind: 'tasks', items: [''] },
      { kind: 'h', level: 2, text: 'Viernes' },
      { kind: 'tasks', items: [''] },
      { kind: 'h', level: 2, text: 'Revisión' },
      {
        kind: 'bullets',
        items: ['Qué avanzó:', 'Qué se atascó:', 'Qué paso a la semana que viene:'],
      },
    ],
  },
  {
    id: 'habitos',
    name: 'Seguimiento de hábitos',
    icon: '🌱',
    group: 'personal',
    summary: 'Base de datos con hábito, frecuencia y racha.',
    title: 'Hábitos',
    blocks: [],
    database: {
      properties: [
        {
          name: 'Frecuencia',
          type: 'select',
          options: [
            { name: 'Diario', color: 'green' },
            { name: 'Días laborables', color: 'blue' },
            { name: 'Semanal', color: 'yellow' },
          ],
        },
        { name: 'Hecho hoy', type: 'checkbox' },
        { name: 'Racha (días)', type: 'number' },
        { name: 'Último registro', type: 'date' },
        { name: 'Por qué me importa', type: 'text' },
      ],
    },
  },
  {
    id: 'lecturas',
    name: 'Lecturas y recursos',
    icon: '📚',
    group: 'personal',
    summary: 'Base de datos de libros, artículos y cursos con su estado.',
    title: 'Lecturas',
    blocks: [],
    database: {
      properties: [
        {
          name: 'Tipo',
          type: 'select',
          options: [
            { name: 'Libro', color: 'purple' },
            { name: 'Artículo', color: 'blue' },
            { name: 'Curso', color: 'green' },
            { name: 'Vídeo', color: 'yellow' },
          ],
        },
        {
          name: 'Estado',
          type: 'status',
          options: [
            { name: 'Pendiente', color: 'gray' },
            { name: 'Leyendo', color: 'blue' },
            { name: 'Terminado', color: 'green' },
            { name: 'Abandonado', color: 'red' },
          ],
        },
        { name: 'Autor', type: 'text' },
        { name: 'Enlace', type: 'url' },
        { name: 'Valoración', type: 'number' },
        { name: 'Terminado el', type: 'date' },
      ],
    },
  },

  // ---- Otras ---------------------------------------------------------------
  {
    id: 'acta-grabada',
    name: 'Reunión grabada',
    icon: '🎥',
    group: 'otras',
    summary: 'Acta de una reunión con grabación: enlace, resumen y acuerdos.',
    title: 'Reunión grabada — ',
    caveat:
      'Nodora no graba ni transcribe: funciona sin conexión y sin integraciones. Esta plantilla organiza el acta y guarda el enlace a la grabación que hagas con tu herramienta habitual.',
    blocks: [
      { kind: 'bullets', items: ['Fecha:', 'Asistentes:', 'Duración:', 'Enlace a la grabación:'] },
      { kind: 'h', level: 2, text: 'Resumen en cinco líneas' },
      { kind: 'p', text: '' },
      { kind: 'h', level: 2, text: 'Momentos clave' },
      { kind: 'bullets', items: ['Minuto — de qué se habló'] },
      { kind: 'h', level: 2, text: 'Acuerdos' },
      { kind: 'bullets', items: [''] },
      { kind: 'h', level: 2, text: 'Tareas derivadas' },
      { kind: 'tasks', items: ['Qué — quién — cuándo'] },
      { kind: 'h', level: 2, text: 'Transcripción o notas literales' },
      { kind: 'p', text: 'Pega aquí la transcripción si la tienes.' },
    ],
  },
  {
    id: 'crm',
    name: 'CRM de oportunidades',
    icon: '🤝',
    group: 'otras',
    summary: 'Base de datos de contactos y oportunidades con su etapa.',
    title: 'CRM',
    blocks: [],
    database: {
      properties: [
        {
          name: 'Etapa',
          type: 'status',
          options: [
            { name: 'Contacto inicial', color: 'gray' },
            { name: 'Cualificado', color: 'blue' },
            { name: 'Propuesta enviada', color: 'yellow' },
            { name: 'Negociación', color: 'purple' },
            { name: 'Ganado', color: 'green' },
            { name: 'Perdido', color: 'red' },
          ],
        },
        { name: 'Empresa', type: 'text' },
        { name: 'Contacto', type: 'text' },
        { name: 'Correo', type: 'text' },
        { name: 'Importe estimado', type: 'number' },
        { name: 'Próximo paso', type: 'text' },
        { name: 'Siguiente contacto', type: 'date' },
        {
          name: 'Origen',
          type: 'select',
          options: [
            { name: 'Referido', color: 'green' },
            { name: 'Web', color: 'blue' },
            { name: 'Evento', color: 'yellow' },
            { name: 'Frío', color: 'gray' },
          ],
        },
      ],
    },
  },
  {
    id: 'panel',
    name: 'Panel de control',
    icon: '📊',
    group: 'otras',
    summary: 'Página índice que reúne enlaces, estado y pendientes de un área.',
    title: 'Panel: ',
    caveat:
      'Todavía no hay fórmulas, gráficos ni relaciones entre bases, así que un panel es una página que reúne enlaces y una tabla filtrada, no métricas calculadas. Las métricas llegarán con el Horizonte 1.',
    blocks: [
      { kind: 'h', level: 2, text: 'Estado de un vistazo' },
      { kind: 'bullets', items: ['Qué va bien:', 'Qué necesita atención:', 'Actualizado el:'] },
      { kind: 'h', level: 2, text: 'Accesos rápidos' },
      { kind: 'bullets', items: ['Enlaza con @ las páginas y bases que consultas a diario.'] },
      { kind: 'h', level: 2, text: 'Pendientes de esta semana' },
      { kind: 'tasks', items: [''] },
      { kind: 'h', level: 2, text: 'Cifras que sigo' },
      { kind: 'bullets', items: ['Métrica — valor — fecha de la lectura'] },
    ],
  },
  {
    id: 'planificador-contenidos',
    name: 'Planificador de contenidos',
    icon: '✍️',
    group: 'otras',
    summary: 'Base de datos editorial: canal, estado, fecha de publicación.',
    title: 'Contenidos',
    blocks: [],
    database: {
      properties: [
        {
          name: 'Estado',
          type: 'status',
          options: [
            { name: 'Idea', color: 'gray' },
            { name: 'Redactando', color: 'blue' },
            { name: 'En revisión', color: 'yellow' },
            { name: 'Programado', color: 'purple' },
            { name: 'Publicado', color: 'green' },
          ],
        },
        {
          name: 'Canal',
          type: 'multi_select',
          options: [
            { name: 'Blog', color: 'blue' },
            { name: 'Newsletter', color: 'green' },
            { name: 'LinkedIn', color: 'purple' },
            { name: 'Instagram', color: 'red' },
            { name: 'YouTube', color: 'yellow' },
          ],
        },
        { name: 'Fecha de publicación', type: 'date' },
        { name: 'Responsable', type: 'text' },
        { name: 'Idea central', type: 'text' },
        { name: 'Enlace', type: 'url' },
      ],
    },
  },
  {
    id: 'planificador-clases',
    name: 'Planificador de clases',
    icon: '🎓',
    group: 'otras',
    summary: 'Sesión con objetivos, materiales, desarrollo y evaluación.',
    title: 'Clase: ',
    blocks: [
      { kind: 'bullets', items: ['Asignatura:', 'Grupo:', 'Fecha:', 'Duración:'] },
      { kind: 'h', level: 2, text: 'Objetivos de aprendizaje' },
      { kind: 'bullets', items: ['Al terminar, el alumnado sabrá…'] },
      { kind: 'h', level: 2, text: 'Materiales' },
      { kind: 'bullets', items: [''] },
      { kind: 'h', level: 2, text: 'Desarrollo' },
      { kind: 'bullets', items: ['Apertura (5 min):', 'Desarrollo (30 min):', 'Cierre (10 min):'] },
      { kind: 'h', level: 2, text: 'Evaluación' },
      { kind: 'bullets', items: ['Qué se observa y cómo se registra.'] },
      { kind: 'h', level: 2, text: 'Después de la clase' },
      { kind: 'bullets', items: ['Qué funcionó:', 'Qué cambiar la próxima vez:'] },
    ],
  },
  {
    id: 'calendario',
    name: 'Calendario de eventos',
    icon: '📆',
    group: 'otras',
    summary: 'Base de datos de eventos con fecha, tipo y estado.',
    title: 'Calendario',
    caveat:
      'La vista de calendario llegará con el Horizonte 1. De momento verás los eventos como una tabla que puedes ordenar por fecha.',
    blocks: [],
    database: {
      properties: [
        { name: 'Fecha', type: 'date' },
        {
          name: 'Tipo',
          type: 'select',
          options: [
            { name: 'Reunión', color: 'blue' },
            { name: 'Entrega', color: 'red' },
            { name: 'Evento', color: 'purple' },
            { name: 'Recordatorio', color: 'yellow' },
          ],
        },
        {
          name: 'Estado',
          type: 'status',
          options: [
            { name: 'Previsto', color: 'gray' },
            { name: 'Confirmado', color: 'green' },
            { name: 'Cancelado', color: 'red' },
          ],
        },
        { name: 'Lugar o enlace', type: 'text' },
        { name: 'Participantes', type: 'text' },
        { name: 'Todo el día', type: 'checkbox' },
      ],
    },
  },
  {
    id: 'journal',
    name: 'Diario personal',
    icon: '🕯️',
    group: 'otras',
    summary: 'Entrada de diario con ánimo, hechos y reflexión.',
    title: 'Diario — ',
    blocks: [
      { kind: 'bullets', items: ['Fecha:', 'Ánimo (1-5):', 'Energía (1-5):'] },
      { kind: 'h', level: 2, text: 'Qué ha pasado hoy' },
      { kind: 'p', text: '' },
      { kind: 'h', level: 2, text: 'Qué he sentido' },
      { kind: 'p', text: '' },
      { kind: 'h', level: 2, text: 'Tres cosas que agradezco' },
      { kind: 'bullets', items: ['', '', ''] },
      { kind: 'h', level: 2, text: 'Qué me llevo' },
      { kind: 'quote', text: 'Una frase que resuma el día.' },
    ],
  },
  {
    id: 'trading-journal',
    name: 'Diario de trading',
    icon: '📈',
    group: 'otras',
    summary: 'Base de datos de operaciones con tesis, gestión y resultado.',
    title: 'Operaciones',
    caveat:
      'Nodora no descarga cotizaciones ni calcula resultados: no hay conexión ni fórmulas. Los importes se anotan a mano, que es justo lo que hace útil un diario de operaciones.',
    blocks: [],
    database: {
      properties: [
        { name: 'Fecha', type: 'date' },
        { name: 'Activo', type: 'text' },
        {
          name: 'Dirección',
          type: 'select',
          options: [
            { name: 'Largo', color: 'green' },
            { name: 'Corto', color: 'red' },
          ],
        },
        { name: 'Entrada', type: 'number' },
        { name: 'Salida', type: 'number' },
        { name: 'Stop', type: 'number' },
        { name: 'Tamaño', type: 'number' },
        { name: 'Resultado', type: 'number' },
        {
          name: 'Cumplí el plan',
          type: 'select',
          options: [
            { name: 'Sí', color: 'green' },
            { name: 'No', color: 'red' },
          ],
        },
        { name: 'Tesis', type: 'text' },
        { name: 'Qué aprendí', type: 'text' },
      ],
    },
  },
  {
    id: 'procedimiento',
    name: 'Procedimiento paso a paso',
    icon: '⚙️',
    group: 'otras',
    summary: 'Un proceso repetible: cuándo se usa, pasos y errores comunes.',
    title: 'Cómo: ',
    blocks: [
      { kind: 'bullets', items: ['Responsable:', 'Frecuencia:', 'Última revisión:'] },
      { kind: 'h', level: 2, text: 'Cuándo se usa' },
      { kind: 'p', text: '' },
      { kind: 'h', level: 2, text: 'Antes de empezar' },
      { kind: 'tasks', items: ['Lo que hay que tener a mano'] },
      { kind: 'h', level: 2, text: 'Pasos' },
      { kind: 'bullets', items: ['1.', '2.', '3.'] },
      { kind: 'h', level: 2, text: 'Errores comunes' },
      { kind: 'bullets', items: ['Síntoma — causa — solución'] },
      { kind: 'h', level: 2, text: 'Cómo saber que salió bien' },
      { kind: 'bullets', items: [''] },
    ],
  },
];

export function templateById(id: string): NodoraTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Nodo mínimo del documento; se corresponde con el validador de Rust. */
interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
}

function texto(text: string): DocNode[] {
  // Un párrafo vacío no lleva hijos: el validador rechaza nodos de texto sin
  // contenido, y así la plantilla deja el cursor listo para escribir.
  return text ? [{ type: 'text', text }] : [];
}

/**
 * Compila la notación breve a ProseMirror. `newId` genera los `blockId`, que
 * deben ser únicos y estables (ADR-005); se inyecta para poder probarla sin
 * depender de crypto.
 */
export function buildTemplateDoc(template: NodoraTemplate, newId: () => string): DocNode {
  const content: DocNode[] = [];
  for (const block of template.blocks) {
    const attrs = { blockId: newId() };
    switch (block.kind) {
      case 'h':
        content.push({
          type: 'heading',
          attrs: { ...attrs, level: block.level },
          content: texto(block.text),
        });
        break;
      case 'p':
        content.push({ type: 'paragraph', attrs, content: texto(block.text) });
        break;
      case 'bullets':
        content.push({
          type: 'bulletList',
          attrs,
          content: block.items.map((item) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: texto(item) }],
          })),
        });
        break;
      case 'tasks':
        content.push({
          type: 'taskList',
          attrs,
          content: block.items.map((item) => ({
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: texto(item) }],
          })),
        });
        break;
      case 'quote':
        content.push({
          type: 'blockquote',
          attrs,
          content: [{ type: 'paragraph', content: texto(block.text) }],
        });
        break;
      case 'callout':
        content.push({
          type: 'callout',
          attrs,
          content: [{ type: 'paragraph', content: texto(block.text) }],
        });
        break;
      case 'code':
        content.push({
          type: 'codeBlock',
          attrs: { ...attrs, language: block.language ?? null },
          content: texto(block.text),
        });
        break;
      case 'divider':
        content.push({ type: 'horizontalRule', attrs });
        break;
    }
  }
  // Un párrafo final asegura que siempre haya dónde seguir escribiendo.
  content.push({ type: 'paragraph', attrs: { blockId: newId() }, content: [] });
  return { type: 'doc', content };
}
