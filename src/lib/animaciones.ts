// Animaciones pesadas que se muestran como video: GIF de más de 300 KB con un MP4 del mismo nombre en public/animaciones
import sharp from 'sharp'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { rutaPoster } from './posters'

export const UMBRAL_VIDEO = 300 * 1024

export interface Animacion {
  mp4: string
  poster: string
  ancho: number
  alto: number
}

const gifs = import.meta.glob('/src/assets/proyectos/**/*.gif')
let catalogo: Promise<Map<string, Animacion>> | null = null

async function armar() {
  const mapa = new Map<string, Animacion>()
  for (const ruta of Object.keys(gifs).sort()) {
    // El build y el servidor de desarrollo corren desde la raíz del proyecto
    const archivo = join(process.cwd(), ruta)
    if (statSync(archivo).size <= UMBRAL_VIDEO) continue
    const nombre = ruta.split('/').pop()!.replace(/\.gif$/i, '')
    if (!existsSync(join(process.cwd(), 'public', 'animaciones', `${nombre}.mp4`))) {
      console.warn(`[animaciones] ${nombre}.gif pesa más de 300 KB y no tiene MP4 en public/animaciones: sigue como imagen animada`)
      continue
    }
    const meta = await sharp(archivo, { animated: true }).metadata()
    mapa.set(nombre, {
      mp4: `/animaciones/${nombre}.mp4`,
      poster: rutaPoster(ruta),
      ancho: meta.width ?? 0,
      alto: meta.pageHeight ?? meta.height ?? 0,
    })
  }
  return mapa
}

// Catálogo por nombre de archivo sin extensión (por ejemplo "vinilos-pag-3"); se arma una vez por build
export function animacionesConVideo() {
  catalogo ??= armar()
  return catalogo
}

export async function animacionDe(nombreOruta: string) {
  const nombre = (nombreOruta.split('/').pop() ?? nombreOruta).replace(/\.gif$/i, '')
  return (await animacionesConVideo()).get(nombre) ?? null
}
