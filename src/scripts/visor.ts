// Visor de imágenes a pantalla completa, compartido por la galería y los proyectos (marcado en Visor.astro)
import { enmascarar } from './mascara'

type Gsap = typeof import('gsap').gsap

export interface ImagenVisor {
  src: string // miniatura o póster, visible hasta que carga la grande o arranca el video
  grande: string
  video?: string // MP4 de las animaciones pesadas
  ancho: number // medidas del original: solo se usa su proporción
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
const ESPERA_DECODIFICACION = 400 // ms máximos antes de cambiar de imagen

export function crearVisor(opciones: OpcionesVisor) {
  const visor = document.querySelector<HTMLDialogElement>('.visor')
  const fondo = visor?.querySelector<HTMLElement>('.visor-fondo')
  const medio = visor?.querySelector<HTMLElement>('.visor-medio')
  const titulo = visor?.querySelector<HTMLAnchorElement>('.visor-titulo') ?? null
  if (!visor || !fondo || !medio || !opciones.imagenes.length) return null

  const imagenes = opciones.imagenes
  const N = imagenes.length
  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)')
  const motor = () => opciones.motor?.() ?? null

  let abierto = false
  let animando = false
  let indiceActual = 0
  let origen: HTMLElement | null = null

  const proporcion = (dato: ImagenVisor) => String(dato.ancho / dato.alto)
  const capaActual = () => medio!.querySelector<HTMLElement>('.visor-capa:last-child')
  const palabrasTitulo = () => (titulo ? [...titulo.querySelectorAll('.mascara-texto')] : [])

  // Capa con la caja final de la imagen desde el primer cuadro: miniatura estirada y la versión grande encima
  // con un fundido al cargar; para las animaciones pesadas, el video con su póster (con movimiento reducido, solo el póster)
  function crearCapa(dato: ImagenVisor) {
    const capa = document.createElement('div')
    capa.className = 'visor-capa'
    capa.style.setProperty('--ratio', proporcion(dato))

    if (dato.video && !movimientoReducido.matches) {
      const video = document.createElement('video')
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.poster = dato.src
      video.setAttribute('role', 'img')
      video.setAttribute('aria-label', dato.alt)
      video.src = dato.video
      capa.append(video)
      return capa
    }

    const miniatura = document.createElement('img')
    miniatura.alt = dato.alt
    miniatura.draggable = false
    miniatura.src = dato.src
    capa.append(miniatura)
    if (dato.grande && dato.grande !== dato.src) {
      const grande = document.createElement('img')
      grande.className = 'visor-grande'
      grande.alt = ''
      grande.setAttribute('aria-hidden', 'true')
      grande.draggable = false
      grande.src = dato.grande
      grande.decode().then(
        () => grande.classList.add('cargada'),
        () => {}
      )
      capa.append(grande)
    }
    return capa
  }

  // Espera a que la capa pueda mostrarse (miniatura decodificada o primer cuadro del video), como máximo ESPERA_DECODIFICACION
  function lista(capa: HTMLElement) {
    const tope = new Promise((resolver) => window.setTimeout(resolver, ESPERA_DECODIFICACION))
    const elemento = capa.firstElementChild
    const carga =
      elemento instanceof HTMLImageElement
        ? elemento.decode().catch(() => {})
        : new Promise((resolver) => elemento?.addEventListener('loadeddata', resolver, { once: true }))
    return Promise.race([carga, tope])
  }

  const videoDe = (capa: HTMLElement | null) => capa?.querySelector('video') ?? null
  const reproducir = (capa: HTMLElement | null) => videoDe(capa)?.play().catch(() => {})

  // Libera la capa: pausa el video y deja de decodificarlo
  function liberar(capa: HTMLElement | null) {
    const video = videoDe(capa)
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    capa?.remove()
  }

  function ponerTitulo(dato: ImagenVisor) {
    if (!titulo || !dato.titulo) return
    titulo.href = dato.href ?? '/proyectos'
    titulo.textContent = dato.titulo
    const gsap = motor()
    if (gsap) {
      enmascarar(titulo)
      gsap.set(palabrasTitulo(), { yPercent: 120 })
    }
  }

  function tituloEntra(retraso = 0) {
    motor()?.to(palabrasTitulo(), { yPercent: 0, duration: 0.6, stagger: 0.04, delay: retraso, ease: 'mascara' })
  }

  function tituloSale() {
    return motor()?.to(palabrasTitulo(), { yPercent: -120, duration: 0.35, stagger: 0.015, ease: 'power3.in' }) ?? null
  }

  // Desplazamiento y escala que llevan el contenedor desde su caja hasta otra (solo transform)
  function haciaCaja(caja: DOMRect) {
    const actual = medio!.getBoundingClientRect()
    return {
      x: caja.left + caja.width / 2 - (actual.left + actual.width / 2),
      y: caja.top + caja.height / 2 - (actual.top + actual.height / 2),
      scale: caja.width / actual.width,
    }
  }

  function abrir(boton: HTMLElement, indice: number) {
    if (abierto) return
    abierto = true
    origen = boton
    const caja = boton.getBoundingClientRect()
    indiceActual = (indice + N) % N
    const dato = imagenes[indiceActual]
    liberar(capaActual())
    medio!.style.setProperty('--ratio', proporcion(dato))
    const capa = crearCapa(dato)
    medio!.append(capa)
    ponerTitulo(dato)
    reproducir(capa)
    const gsap = motor()
    visor!.classList.toggle('sin-motor', !gsap)
    opciones.alAbrir?.()

    if (!gsap) {
      // Fundido con transiciones de CSS
      medio!.style.opacity = '0'
      fondo!.style.opacity = '0'
      visor!.showModal()
      requestAnimationFrame(() => {
        fondo!.style.opacity = ''
        medio!.style.opacity = ''
      })
      return
    }

    visor!.showModal()
    animando = true
    gsap.fromTo(fondo, { opacity: 0 }, { opacity: 1, duration: DESENFOQUE, ease: 'power2.inOut' })
    boton.style.visibility = 'hidden'
    gsap.set(medio, { x: 0, y: 0, scale: 1, opacity: 1 })
    gsap.from(medio, {
      ...haciaCaja(caja),
      duration: ZOOM,
      ease: 'hop',
      onComplete: () => {
        animando = false
      },
    })
    tituloEntra(0.5)
  }

  // Imagen vecina en el orden de la lista: fundido cruzado entre las dos capas, cada una con su caja
  async function vecina(paso: number) {
    if (!abierto || animando) return
    const saliente = capaActual()
    indiceActual = (indiceActual + paso + N) % N
    const dato = imagenes[indiceActual]
    const entrante = crearCapa(dato)

    if (!saliente || movimientoReducido.matches) {
      // Cambio instantáneo
      liberar(saliente)
      medio!.style.setProperty('--ratio', proporcion(dato))
      medio!.append(entrante)
      ponerTitulo(dato)
      tituloEntra()
      reproducir(entrante)
      return
    }

    animando = true
    videoDe(saliente)?.pause()
    entrante.style.opacity = '0'
    medio!.append(entrante)

    const salidaTitulo = tituloSale()
    await lista(entrante)
    entrante.style.opacity = ''
    const duracion = parseFloat(getComputedStyle(visor!).getPropertyValue('--visor-cruzado')) || 400
    const animaciones = [
      saliente.animate({ opacity: [1, 0] }, { duration: duracion, easing: 'ease-in-out', fill: 'both' }),
      entrante.animate({ opacity: [0, 1] }, { duration: duracion, easing: 'ease-in-out', fill: 'both' }),
    ]
    if (salidaTitulo) {
      salidaTitulo.eventCallback('onComplete', () => {
        ponerTitulo(dato)
        tituloEntra(0.1)
      })
    } else ponerTitulo(dato)

    await Promise.all(animaciones.map((animacion) => animacion.finished.catch(() => {})))
    liberar(saliente)
    // El contenedor pasa a la caja de la nueva imagen al terminar; no tiene nada visible, así que no se nota
    medio!.style.setProperty('--ratio', proporcion(dato))
    animaciones.forEach((animacion) => animacion.cancel())
    reproducir(entrante)
    animando = false
  }

  function cerrar() {
    if (!abierto || animando) return
    videoDe(capaActual())?.pause()
    const terminar = (destino: HTMLElement | null) => {
      visor!.close()
      liberar(capaActual())
      motor()?.set(medio, { clearProps: 'transform,opacity' })
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
      medio!.style.opacity = '0'
      animando = true
      window.setTimeout(() => {
        fondo!.style.opacity = ''
        medio!.style.opacity = ''
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
      gsap.to(medio, {
        ...haciaCaja(destino.getBoundingClientRect()),
        duration: ZOOM,
        ease: 'hop',
        onComplete: () => terminar(destino),
      })
    } else {
      gsap.to(medio, { opacity: 0, scale: 0.9, duration: 0.4, ease: 'power2.inOut', onComplete: () => terminar(null) })
    }
  }

  // .subrayado se agrega después de la carga: el texto del enlace cambia con cada imagen
  titulo?.classList.add('subrayado')
  visor.querySelector('.visor-anterior')?.addEventListener('click', () => vecina(-1))
  visor.querySelector('.visor-siguiente')?.addEventListener('click', () => vecina(1))
  visor.querySelector('.visor-cerrar')?.addEventListener('click', cerrar)
  fondo.addEventListener('click', cerrar)
  medio.addEventListener('click', cerrar)
  visor.addEventListener('cancel', (e) => {
    e.preventDefault()
    cerrar()
  })
  visor.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') vecina(-1)
    if (e.key === 'ArrowRight') vecina(1)
  })

  return {
    abrir,
    abierto: () => abierto,
    origen: () => origen,
  }
}
