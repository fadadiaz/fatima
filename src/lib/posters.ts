// Pósters estáticos de las animaciones pesadas de la galería, generados en el build con sharp
import sharp from 'sharp'
import { join } from 'node:path'

// Cuadro forzado por archivo, por ejemplo { "behance-nubes-05.gif": 40 }; sin entrada, se elige el de más contenido
export const CUADRO_POSTER: Record<string, number> = {}

// Animaciones cuya miniatura animada (al doble del ancho mostrado) supera este peso usan póster
export const UMBRAL_ANIMADA = 150 * 1024
export const ANCHO_MINIATURA = 720

export interface InfoAnimacion {
  pesada: boolean
  cuadros: number
  pesoMiniatura: number
  cuadro?: number
  primeroEnBlanco?: boolean
  poster?: Buffer
  ancho?: number
  alto?: number
}

const cache = new Map<string, Promise<InfoAnimacion>>()

// Proporción de píxeles distintos del color dominante del cuadro (0 = cuadro liso)
async function contenido(archivo: string, pagina: number) {
  const { data, info } = await sharp(archivo, { page: pagina })
    .resize({ width: 64 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const conteo = new Map<number, number>()
  for (let i = 0; i < data.length; i += info.channels) {
    // Color reducido a 4 bits por canal para agrupar tonos casi iguales
    const clave = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
  }
  const total = data.length / info.channels
  return 1 - Math.max(...conteo.values()) / total
}

async function analizar(archivo: string, nombre: string): Promise<InfoAnimacion> {
  const meta = await sharp(archivo, { animated: true }).metadata()
  const cuadros = meta.pages ?? 1
  const ancho = Math.min(ANCHO_MINIATURA, meta.width ?? ANCHO_MINIATURA)
  const miniatura = await sharp(archivo, { animated: true }).resize({ width: ancho }).webp().toBuffer()
  if (cuadros < 2 || miniatura.length <= UMBRAL_ANIMADA) {
    return { pesada: false, cuadros, pesoMiniatura: miniatura.length }
  }

  // Cuadro con más contenido entre el 15% y el 85% de la animación
  const desde = Math.floor(cuadros * 0.15)
  const hasta = Math.max(desde, Math.ceil(cuadros * 0.85) - 1)
  let cuadro = desde
  let mejor = -1
  for (let i = desde; i <= hasta; i++) {
    const valor = await contenido(archivo, i)
    if (valor > mejor) {
      mejor = valor
      cuadro = i
    }
  }
  if (CUADRO_POSTER[nombre] !== undefined) cuadro = Math.min(cuadros - 1, Math.max(0, CUADRO_POSTER[nombre]))

  const poster = await sharp(archivo, { page: cuadro }).resize({ width: ancho }).webp({ quality: 80 }).toBuffer()
  const alto = Math.round((ancho * (meta.pageHeight ?? meta.height ?? ancho)) / (meta.width ?? ancho))
  return {
    pesada: true,
    cuadros,
    pesoMiniatura: miniatura.length,
    cuadro,
    primeroEnBlanco: (await contenido(archivo, 0)) < 0.02,
    poster,
    ancho,
    alto,
  }
}

// Análisis de una animación por su ruta del glob (/src/assets/...); se calcula una sola vez por build
export function analizarAnimacion(ruta: string) {
  const nombre = ruta.split('/').pop() ?? ruta
  if (!cache.has(ruta)) {
    // El build y el servidor de desarrollo corren desde la raíz del proyecto
    const archivo = join(process.cwd(), ruta)
    cache.set(ruta, analizar(archivo, nombre))
  }
  return cache.get(ruta)!
}

export const rutaPoster = (ruta: string) => `/galeria/poster/${(ruta.split('/').pop() ?? ruta).replace(/\.gif$/i, '')}.webp`
