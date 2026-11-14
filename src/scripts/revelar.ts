// Revela las palabras de los bloques con data-reveal según el scroll.
// Todos los párrafos del bloque comparten un único progreso: las palabras se
// revelan en una sola secuencia, en orden de lectura. Con data-reveal="intro",
// al entrar en pantalla se revelan solas y después el scroll toma el control.

const OPACIDAD_MINIMA = 0.15
// Cuántas palabras abarca la transición de atenuada a visible
const SUAVIDAD = 4
// El progreso arranca cuando el bloque llega al 85% de la ventana y termina cuando su final llega al 55%
const INICIO = 0.85
const FIN = 0.55
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
  introPendiente: boolean
  inicioIntro: number | null
  // Final del bloque cuando su sección ocupa la pantalla: en esa posición cuenta como revelado
  finEnReposo: number
}

// Divide el texto en palabras sin tocar los elementos internos (imágenes, enlaces)
function partir(contenedor: HTMLElement) {
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
          palabra.style.transition = 'opacity 0.15s linear'
          palabra.style.opacity = String(OPACIDAD_MINIMA)
          fragmento.append(palabra)
          palabras.push(palabra)
        })
        hijo.replaceWith(fragmento)
      } else if (hijo instanceof HTMLElement) {
        if (hijo.textContent?.trim()) {
          procesar(hijo)
        } else {
          // Elementos sin texto (como los emojis) aparecen junto con la palabra anterior
          hijo.style.transition = 'opacity 0.15s linear'
          hijo.style.opacity = String(OPACIDAD_MINIMA)
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

function opacidad(avance: number, i: number) {
  const parte = Math.min(1, Math.max(0, (avance - i) / SUAVIDAD))
  return OPACIDAD_MINIMA + (1 - OPACIDAD_MINIMA) * parte
}

let pendiente = false

function actualizar(ahora: number) {
  pendiente = false
  const alto = window.innerHeight
  let seguirIntro = false

  bloques.forEach((bloque) => {
    const caja = bloque.contenedor.getBoundingClientRect()
    const inicio = alto * INICIO
    const fin = bloque.intro ? Math.max(alto * FIN, bloque.finEnReposo) : alto * FIN
    let progreso = Math.min(1, Math.max(0, (inicio - caja.top) / (inicio - fin + caja.height)))

    // Revelado automático al entrar en pantalla; después manda el scroll
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

    const avance = progreso * (bloque.palabras.length + SUAVIDAD)
    bloque.palabras.forEach((palabra, i) => {
      palabra.style.opacity = String(opacidad(avance, i))
    })
    bloque.adjuntos.forEach(({ elemento, indice }) => {
      elemento.style.opacity = String(opacidad(avance, indice))
    })

    bloque.contenedor.classList.toggle(
      'revelado',
      progreso >= 1 && bloque.inicioIntro === null && !bloque.introPendiente
    )
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
    const { palabras, adjuntos } = partir(contenedor)
    const intro = contenedor.dataset.reveal === 'intro'
    const seccion = contenedor.closest('section') ?? contenedor
    bloques.push({
      contenedor,
      palabras,
      adjuntos,
      intro,
      introPendiente: intro,
      inicioIntro: null,
      finEnReposo:
        contenedor.getBoundingClientRect().bottom - seccion.getBoundingClientRect().top,
    })
    contenedor.classList.add('reveal-activo')
  })

  if (bloques.length) {
    window.addEventListener('scroll', pedir, { passive: true })
    window.addEventListener('resize', pedir)
    pedir()
  }
}
