// Revelado de palabras con data-reveal; opciones: data-reveal="intro", data-reveal-salida, data-reveal-umbrales y data-reveal-modo="resaltar"

// Modo resaltar, en porcentaje de la altura de la ventana: inicio para el borde superior, fin para el inferior
const RESALTADO = {
  inicio: 85,
  fin: 45,
}

// Umbrales de la animación de palabras, en porcentaje de la altura de la ventana (0 arriba, 100 abajo)
// Valores originales: entradaInicio 85, entradaFin 55, salidaInicio 35, salidaFin 5
const UMBRALES = {
  general: {
    // Parte superior del bloque: empieza a revelarse
    entradaInicio: 85,
    // Parte inferior del bloque: termina de revelarse
    entradaFin: 55,
    // Parte superior del bloque: empieza a atenuarse
    salidaInicio: 35,
    // Parte inferior del bloque: termina de atenuarse
    salidaFin: 5,
  },
  // Presentación del inicio, valores de prueba
  presentacion: {
    entradaInicio: 85,
    entradaFin: 80,
    salidaInicio: 15,
    salidaFin: -10,
  },
}

type Umbrales = (typeof UMBRALES)['general']

const OPACIDAD_MINIMA = 0.15
// Cuántas palabras abarca la transición de atenuada a visible
const SUAVIDAD = 4
// Desde qué visibilidad una palabra cuenta como completa para mostrar los elementos que dependen del texto
const VISIBLE = 0.99
const DURACION_INTRO = 1500

interface Adjunto {
  elemento: HTMLElement
  indice: number
}

interface Bloque {
  contenedor: HTMLElement
  palabras: HTMLElement[]
  adjuntos: Adjunto[]
  intro: boolean
  salida: boolean
  umbrales: Umbrales
  introPendiente: boolean
  inicioIntro: number | null
  // Sección del bloque: cuando ocupa la pantalla, el bloque está en reposo y se ve completo
  seccion: Element
}

interface Resaltado {
  contenedor: HTMLElement
  elementos: HTMLElement[]
}

// Divide el texto en palabras sin tocar los elementos internos (imágenes, enlaces)
function partir(contenedor: HTMLElement, conOpacidad = true) {
  const palabras: HTMLElement[] = []
  const adjuntos: Adjunto[] = []

  const procesar = (nodo: Node) => {
    ;[...nodo.childNodes].forEach((hijo) => {
      if (hijo.nodeType === Node.TEXT_NODE) {
        const partes = (hijo.textContent ?? '').split(/(\s+)/)
        const fragmento = document.createDocumentFragment()
        partes.forEach((parte) => {
          if (!parte) return
          if (/^\s+$/.test(parte)) {
            fragmento.append(parte)
            return
          }
          const palabra = document.createElement('span')
          palabra.className = 'palabra'
          palabra.textContent = parte
          if (conOpacidad) {
            palabra.style.transition = 'opacity 0.15s linear'
            palabra.style.opacity = String(OPACIDAD_MINIMA)
          }
          fragmento.append(palabra)
          palabras.push(palabra)
        })
        hijo.replaceWith(fragmento)
      } else if (hijo instanceof HTMLElement) {
        if (hijo.textContent?.trim()) {
          procesar(hijo)
        } else {
          // Elementos sin texto (como los emojis) aparecen junto con la palabra anterior
          if (conOpacidad) {
            hijo.style.transition = 'opacity 0.15s linear'
            hijo.style.opacity = String(OPACIDAD_MINIMA)
          }
          adjuntos.push({ elemento: hijo, indice: Math.max(0, palabras.length - 1) })
        }
      }
    })
  }

  const parrafos = contenedor.matches('p') ? [contenedor] : [...contenedor.querySelectorAll<HTMLElement>('p')]
  parrafos.forEach(procesar)
  return { palabras, adjuntos }
}

const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)')
const bloques: Bloque[] = []
const resaltados: Resaltado[] = []

// Cuánto avanzó la palabra i en una secuencia (0 a 1), con transición entre vecinas
const parte = (avance: number, i: number) => Math.min(1, Math.max(0, (avance - i) / SUAVIDAD))

const limitar = (valor: number) => Math.min(1, Math.max(0, valor))

function opacidad(entrada: number, salida: number, i: number) {
  const visible = Math.min(parte(entrada, i), 1 - parte(salida, i))
  return OPACIDAD_MINIMA + (1 - OPACIDAD_MINIMA) * visible
}

let pendiente = false

function actualizar(ahora: number) {
  pendiente = false
  const alto = window.innerHeight
  let seguirIntro = false

  bloques.forEach((bloque) => {
    const caja = bloque.contenedor.getBoundingClientRect()
    const seccion = bloque.seccion.getBoundingClientRect()
    // Posición del bloque cuando su sección ocupa la pantalla
    const arribaEnReposo = caja.top - seccion.top
    const abajoEnReposo = caja.bottom - seccion.top

    const u = bloque.umbrales
    const inicio = (alto * u.entradaInicio) / 100
    const finBase = (alto * u.entradaFin) / 100
    const fin = bloque.intro ? Math.max(finBase, abajoEnReposo) : finBase
    let progreso = limitar((inicio - caja.top) / (inicio - fin + caja.height))

    // Salida por arriba; nunca empieza antes de dejar la posición de reposo
    let progresoSalida = 0
    if (bloque.salida) {
      const inicioSalida = Math.min((alto * u.salidaInicio) / 100, arribaEnReposo)
      const finSalida = (alto * u.salidaFin) / 100
      progresoSalida = limitar((inicioSalida - caja.top) / (inicioSalida - finSalida + caja.height))
    }

    if (bloque.introPendiente && caja.top < alto) {
      bloque.introPendiente = false
      bloque.inicioIntro = ahora
    }
    if (bloque.inicioIntro !== null) {
      const t = Math.min(1, (ahora - bloque.inicioIntro) / DURACION_INTRO)
      const suave = 1 - Math.pow(1 - t, 2)
      progreso = Math.min(progreso, suave)
      if (t < 1) seguirIntro = true
      else bloque.inicioIntro = null
    }

    const largo = bloque.palabras.length + SUAVIDAD
    const avance = progreso * largo
    const avanceSalida = progresoSalida * largo
    bloque.palabras.forEach((palabra, i) => {
      palabra.style.opacity = String(opacidad(avance, avanceSalida, i))
    })
    bloque.adjuntos.forEach(({ elemento, indice }) => {
      elemento.style.opacity = String(opacidad(avance, avanceSalida, indice))
    })

    const ultima = bloque.palabras.length - 1
    const completo = Math.min(parte(avance, ultima), 1 - parte(avanceSalida, 0)) >= VISIBLE
    bloque.contenedor.classList.toggle(
      'revelado',
      completo && bloque.inicioIntro === null && !bloque.introPendiente
    )
  })

  resaltados.forEach(({ contenedor, elementos }) => {
    const caja = contenedor.getBoundingClientRect()
    const inicio = (alto * RESALTADO.inicio) / 100
    const fin = (alto * RESALTADO.fin) / 100
    const progreso = limitar((inicio - caja.top) / (inicio - fin + caja.height))
    elementos.forEach((elemento, i) => {
      elemento.classList.toggle('encendida', progreso > i / elementos.length)
    })
  })

  if (seguirIntro) pedir()
}

function pedir() {
  if (pendiente) return
  pendiente = true
  requestAnimationFrame(actualizar)
}

if (!movimientoReducido.matches) {
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((contenedor) => {
    if (contenedor.dataset.revealModo === 'resaltar') {
      const { adjuntos } = partir(contenedor, false)
      adjuntos.forEach(({ elemento }) => elemento.classList.add('palabra'))
      resaltados.push({ contenedor, elementos: [...contenedor.querySelectorAll<HTMLElement>('.palabra')] })
      contenedor.classList.add('reveal-activo')
      return
    }

    const { palabras, adjuntos } = partir(contenedor)
    const intro = contenedor.dataset.reveal === 'intro'
    bloques.push({
      contenedor,
      palabras,
      adjuntos,
      intro,
      salida: contenedor.hasAttribute('data-reveal-salida'),
      umbrales: UMBRALES[contenedor.dataset.revealUmbrales as keyof typeof UMBRALES] ?? UMBRALES.general,
      introPendiente: intro,
      inicioIntro: null,
      seccion: contenedor.closest('section') ?? contenedor,
    })
    contenedor.classList.add('reveal-activo')
  })

  if (bloques.length || resaltados.length) {
    window.addEventListener('scroll', pedir, { passive: true })
    window.addEventListener('resize', pedir)
    pedir()
  }
}
