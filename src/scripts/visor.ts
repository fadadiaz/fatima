// Visor de imágenes a pantalla completa, compartido por la galería y los proyectos (marcado en Visor.astro)
import { enmascarar } from './mascara'

type Gsap = typeof import('gsap').gsap

export interface ImagenVisor {
  src: string // miniatura, visible hasta que carga la grande
  grande: string
  ancho: number
  alto: number
  alt: string
  titulo?: string
  href?: string
}

export interface OpcionesVisor {
  imagenes: ImagenVisor[]
  // Con GSAP, la imagen se expande desde su posición; sin GSAP, aparece con un fundido
  motor?: () => Gsap | null
  // Elemento hacia el que vuelve la imagen al cerrar (solo con GSAP)
  destinoDeCierre?: (indice: number, origen: HTMLElement | null) => HTMLElement | null
  alAbrir?: () => void
  alCerrar?: () => void
  alTerminar?: () => void
}

const ZOOM = 0.6 // s
const DESENFOQUE = 0.4 // s
const EXPANDIDO = { alto: 0.8, ancho: 0.86 } // parte de la ventana que ocupa la imagen abierta

export function crearVisor(opciones: OpcionesVisor) {
  const visor = document.querySelector<HTMLDialogElement>('.visor')
  const fondo = visor?.querySelector<HTMLElement>('.visor-fondo')
  const imagen = visor?.querySelector<HTMLImageElement>('.visor-imagen')
  const titulo = visor?.querySelector<HTMLAnchorElement>('.visor-titulo') ?? null
  if (!visor || !fondo || !imagen || !opciones.imagenes.length) return null

  const imagenes = opciones.imagenes
  const N = imagenes.length
  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)')
  const motor = () => opciones.motor?.() ?? null

  let abierto = false
  let animando = false
  let indiceActual = 0
  let origen: HTMLElement | null = null

  // Tamaño de la imagen abierta: el mayor que entra en la ventana con su proporción
  function tamanoAbierto(dato: ImagenVisor) {
    const escala = Math.min(
      (window.innerWidth * EXPANDIDO.ancho) / dato.ancho,
      (window.innerHeight * EXPANDIDO.alto) / dato.alto
    )
    return { ancho: dato.ancho * escala, alto: dato.alto * escala }
  }

  const palabrasTitulo = () => (titulo ? [...titulo.querySelectorAll('.mascara-texto')] : [])

  function cargar(indice: number) {
    indiceActual = (indice + N) % N
    const dato = imagenes[indiceActual]
    imagen!.removeAttribute('srcset')
    imagen!.src = dato.src
    imagen!.alt = dato.alt
    imagen!.width = dato.ancho
    imagen!.height = dato.alto
    const grande = new Image()
    grande.src = dato.grande
    grande.decode().then(
      () => {
        if (imagenes[indiceActual] === dato) imagen!.src = dato.grande
      },
      () => {}
    )
    if (titulo && dato.titulo) {
      titulo.href = dato.href ?? '/proyectos'
      titulo.textContent = dato.titulo
      const gsap = motor()
      if (gsap) {
        enmascarar(titulo)
        gsap.set(palabrasTitulo(), { yPercent: 120 })
      }
    }
  }

  function tituloEntra(retraso = 0) {
    motor()?.to(palabrasTitulo(), { yPercent: 0, duration: 0.6, stagger: 0.04, delay: retraso, ease: 'mascara' })
  }

  function tituloSale() {
    return motor()?.to(palabrasTitulo(), { yPercent: -120, duration: 0.35, stagger: 0.015, ease: 'power3.in' }) ?? null
  }

  function ajustarTamano() {
    const destino = tamanoAbierto(imagenes[indiceActual])
    Object.assign(imagen!.style, { width: `${destino.ancho}px`, height: `${destino.alto}px` })
  }

  function abrir(boton: HTMLElement, indice: number) {
    if (abierto) return
    abierto = true
    origen = boton
    const caja = boton.getBoundingClientRect()
    cargar(indice)
    const destino = tamanoAbierto(imagenes[indiceActual])
    const gsap = motor()
    visor!.classList.toggle('sin-motor', !gsap)
    opciones.alAbrir?.()

    if (!gsap) {
      // Fundido con transiciones de CSS
      ajustarTamano()
      Object.assign(imagen!.style, { transform: 'translate(-50%, -50%)', opacity: '0' })
      fondo!.style.opacity = '0'
      visor!.showModal()
      requestAnimationFrame(() => {
        fondo!.style.opacity = ''
        imagen!.style.opacity = ''
      })
      return
    }

    visor!.showModal()
    animando = true
    gsap.fromTo(fondo, { opacity: 0 }, { opacity: 1, duration: DESENFOQUE, ease: 'power2.inOut' })
    boton.style.visibility = 'hidden'
    gsap.set(imagen, { xPercent: -50, yPercent: -50, opacity: 1, scale: 1 })
    gsap.fromTo(
      imagen,
      {
        width: caja.width,
        height: caja.height,
        x: caja.left + caja.width / 2 - window.innerWidth / 2,
        y: caja.top + caja.height / 2 - window.innerHeight / 2,
      },
      {
        width: destino.ancho,
        height: destino.alto,
        x: 0,
        y: 0,
        duration: ZOOM,
        ease: 'hop',
        onComplete: () => {
          animando = false
        },
      }
    )
    tituloEntra(0.5)
  }

  // Imagen vecina en el orden de la lista, con la misma transición
  function vecina(paso: number) {
    if (!abierto || animando) return
    const gsap = motor()
    if (!gsap) {
      cargar(indiceActual + paso)
      ajustarTamano()
      return
    }
    animando = true
    const siguiente = () => {
      cargar(indiceActual + paso)
      const destino = tamanoAbierto(imagenes[indiceActual])
      gsap.to(imagen, {
        width: destino.ancho,
        height: destino.alto,
        duration: ZOOM,
        ease: 'hop',
        onComplete: () => {
          animando = false
        },
      })
      tituloEntra(0.2)
    }
    const salida = tituloSale()
    if (salida) salida.eventCallback('onComplete', siguiente)
    else siguiente()
  }

  function cerrar() {
    if (!abierto || animando) return
    const terminar = (destino: HTMLElement | null) => {
      visor!.close()
      if (origen) origen.style.visibility = ''
      if (destino) destino.style.visibility = ''
      abierto = false
      animando = false
      origen?.focus({ preventScroll: true })
      opciones.alTerminar?.()
    }

    opciones.alCerrar?.()
    const gsap = motor()
    if (!gsap) {
      fondo!.style.opacity = '0'
      imagen!.style.opacity = '0'
      animando = true
      window.setTimeout(() => {
        fondo!.style.opacity = ''
        terminar(null)
      }, movimientoReducido.matches ? 0 : DESENFOQUE * 1000)
      return
    }

    animando = true
    const destino = opciones.destinoDeCierre?.(indiceActual, origen) ?? null
    tituloSale()
    gsap.to(fondo, { opacity: 0, duration: DESENFOQUE, ease: 'power2.inOut' })
    if (destino) {
      if (origen && destino !== origen) origen.style.visibility = ''
      destino.style.visibility = 'hidden'
      const caja = destino.getBoundingClientRect()
      gsap.to(imagen, {
        width: caja.width,
        height: caja.height,
        x: caja.left + caja.width / 2 - window.innerWidth / 2,
        y: caja.top + caja.height / 2 - window.innerHeight / 2,
        duration: ZOOM,
        ease: 'hop',
        onComplete: () => terminar(destino),
      })
    } else {
      gsap.to(imagen, { opacity: 0, scale: 0.9, duration: 0.4, ease: 'power2.inOut', onComplete: () => terminar(null) })
    }
  }

  // .subrayado se agrega después de la carga: el texto del enlace cambia con cada imagen
  titulo?.classList.add('subrayado')
  visor.querySelector('.visor-anterior')?.addEventListener('click', () => vecina(-1))
  visor.querySelector('.visor-siguiente')?.addEventListener('click', () => vecina(1))
  visor.querySelector('.visor-cerrar')?.addEventListener('click', cerrar)
  fondo.addEventListener('click', cerrar)
  imagen.addEventListener('click', cerrar)
  visor.addEventListener('cancel', (e) => {
    e.preventDefault()
    cerrar()
  })
  visor.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') vecina(-1)
    if (e.key === 'ArrowRight') vecina(1)
  })
  window.addEventListener('resize', () => {
    if (!abierto) return
    const gsap = motor()
    const destino = tamanoAbierto(imagenes[indiceActual])
    if (gsap) gsap.set(imagen, { width: destino.ancho, height: destino.alto })
    else ajustarTamano()
  })

  return {
    abrir,
    abierto: () => abierto,
    origen: () => origen,
  }
}
