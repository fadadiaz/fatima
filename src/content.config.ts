import { z, defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/proyectos' }),
  schema: z.object({
    titulo: z.string(),
    descripcion: z.string().optional(),
    categoria: z.enum(['Identidad Visual', 'Diseño Web', 'Integraciones Digitales', 'Diseño editorial']),
    fecha: z.string(),
    portada: z.string(),
    destacado: z.boolean().default(false),
    enlaces: z.array(z.object({
      texto: z.string(),
      href: z.string(),
    })).optional(),
    carpeta: z.string().optional(),
  })
})

export const collections = { proyectos }

