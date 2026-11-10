import { z, defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/proyectos' }),
  schema: ({ image }) => z.object({
    titulo: z.string(),
    descripcion: z.string().optional(),
    categoria: z.enum(['Identidad Visual', 'Diseño Web', 'Integraciones Digitales', 'Herramientas Digitales', 'Diseño editorial']),
    fecha: z.string(),
    portada: image(),
    destacado: z.boolean().default(false),
    enlaces: z.array(z.object({
      texto: z.string(),
      href: z.string(),
    })).optional(),
    carpeta: z.string().optional(),
  })
})

export const collections = { proyectos }

