// Resaltado de palabras por scroll en los bloques con data-reveal-modo="resaltar"

// Umbrales en porcentaje de la altura de la ventana: inicio para el borde superior, fin para el inferior
const RESALTADO = {
  inicio: 85,
  fin: 45,
}

interface Resaltado {
  contenedor: HTMLElement
  palabras: HTMLElement[]
  adjuntos: { elemento: HTMLElement; indice: number }[]
}

// Divide el texto en palabras sin tocar los elementos internos (imágenes, enlaces)
function partir(contenedor: HTMLElement): Resaltado {
  const palabras: HTMLElement[] = []
  const adjuntos: Resaltado['adjuntos'] = []

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
          fragmento.append(palabra)
          palabras.push(palabra)
        })
        hijo.replaceWith(fragmento)
      } else if (hijo instanceof HTMLElement) {
        if (hijo.textContent?.trim()) {
          procesar(hijo)
        } else {
          // Elementos sin texto (como los emojis) siguen a la palabra anterior
          hijo.classList.add('adjunto')
          adjuntos.push({ elemento: hijo, indice: Math.max(0, palabras.length - 1) })
        }
      }
    })
  }

  const parrafos = contenedor.matches('p') ? [contenedor] : [...contenedor.querySelectorAll<HTMLElement>('p')]
  parrafos.forEach(procesar)
  return { contenedor, palabras, adjuntos }
}

const limitar = (valor: number) => Math.min(1, Math.max(0, valor))
const resaltados: Resaltado[] = []
let pendiente = false

function actualizar() {
  pendiente = false
  const alto = window.innerHeight
  const inicio = (alto * RESALTADO.inicio) / 100
  const fin = (alto * RESALTADO.fin) / 100

  resaltados.forEach(({ contenedor, palabras, adjuntos }) => {
    const caja = contenedor.getBoundingClientRect()
    const progreso = limitar((inicio - caja.top) / (inicio - fin + caja.height))
    const encendida = (i: number) => progreso > i / palabras.length

    palabras.forEach((palabra, i) => palabra.classList.toggle('encendida', encendida(i)))
    adjuntos.forEach(({ elemento, indice }) => elemento.classList.toggle('encendida', encendida(indice)))
  })
}

function pedir() {
  if (pendiente) return
  pendiente = true
  requestAnimationFrame(actualizar)
}

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll<HTMLElement>('[data-reveal-modo="resaltar"]').forEach((contenedor) => {
    resaltados.push(partir(contenedor))
    contenedor.classList.add('reveal-activo')
  })

  if (resaltados.length) {
    window.addEventListener('scroll', pedir, { passive: true })
    window.addEventListener('resize', pedir)
    pedir()
  }
}
