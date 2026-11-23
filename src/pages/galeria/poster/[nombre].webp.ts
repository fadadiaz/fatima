// Pósters estáticos de las animaciones pesadas de la galería (ver src/lib/posters.ts)
import type { APIRoute, GetStaticPaths } from 'astro'
import { analizarAnimacion } from '../../../lib/posters'

const animaciones = import.meta.glob('/src/assets/proyectos/*/*.gif')

export const getStaticPaths: GetStaticPaths = async () => {
  const rutas = Object.keys(animaciones)
  const info = await Promise.all(rutas.map((ruta) => analizarAnimacion(ruta)))
  return rutas
    .filter((_, i) => info[i].pesada)
    .map((ruta) => ({
      params: { nombre: (ruta.split('/').pop() ?? ruta).replace(/\.gif$/i, '') },
      props: { ruta },
    }))
}

export const GET: APIRoute = async ({ props }) => {
  const info = await analizarAnimacion(props.ruta as string)
  return new Response(new Uint8Array(info.poster!), { headers: { 'Content-Type': 'image/webp' } })
}
