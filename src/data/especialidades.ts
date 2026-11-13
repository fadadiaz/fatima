// Especialidades: compartidas por el inicio y la página de especialidades
export interface Especialidad {
  id: string
  nombre: string
  descripcion: string
  ejemplo: string
  etiquetas: string[]
}

export const especialidades: Especialidad[] = [
  {
    id: 'identidad-visual',
    nombre: 'Identidad visual',
    descripcion:
      'Construimos juntos la imagen de tu marca, desde cero o a partir de la identidad que ya tenés. Me enfoco en que sea coherente, genuina y lista para usarse en cualquier contexto, digital o impreso. Diseño para que se vea bien y funcione.',
    ejemplo:
      'un logotipo con su manual de marca, la papelería de una empresa, el kit de piezas para sus redes, las etiquetas de un producto.',
    etiquetas: [
      'Branding',
      'Rediseño de marca',
      'Kit para redes',
      'Papelería corporativa',
      'Etiquetas y packaging',
      'Presentaciones',
      'Manual de marca',
      'Paleta de colores',
    ],
  },
  {
    id: 'diseno-web',
    nombre: 'Diseño web',
    descripcion:
      'Tu página web no debería ser un dolor de cabeza, ni para vos ni para quienes la usan. Diseño según las necesidades reales de cada proyecto, ya sea que arranques desde cero o quieras mejorar lo que ya tenés.',
    ejemplo:
      'una landing page, un portfolio, el menú digital de un local, el rediseño de una página que ya existe.',
    etiquetas: [
      'Landing pages',
      'WordPress',
      'Tiendas online',
      'Notion',
      'Portfolios',
      'Menú digital',
      'Figma a código',
      'UI Design',
      'Rediseño web',
      'Mantenimiento web',
    ],
  },
  {
    id: 'diseno-editorial',
    nombre: 'Diseño editorial',
    descripcion:
      'Revistas, libros, afiches y folletos pensados como un conjunto: el concepto, la tipografía, el ritmo de cada página y cómo va a imprimirse. Me ocupo desde la idea hasta la maquetación y la preprensa.',
    ejemplo: 'una revista, un libro con su tapa y su dossier, un afiche, un folleto.',
    etiquetas: ['Revistas', 'Libros', 'Afiches', 'Folletos', 'Maquetación', 'Preprensa'],
  },
  {
    id: 'herramientas-digitales',
    nombre: 'Herramientas digitales',
    descripcion:
      'Más allá del diseño, te ayudo a automatizar tareas repetitivas y a crear herramientas a medida que simplifican cómo trabajás. Formularios inteligentes, documentos que se generan solos, aplicaciones de gestión para el celular: soluciones que te ahorran tiempo real.',
    ejemplo:
      'un formulario inteligente, un documento que se genera automáticamente, una aplicación de gestión para el celular, el control de stock de un negocio.',
    etiquetas: [
      'Automatización',
      'Formularios inteligentes',
      'Apps a medida',
      'Gestión de clientes',
      'AppSheet',
      'Apps Script',
      'Google Workspace',
      'Generación de documentos',
      'Control de stock',
    ],
  },
]
