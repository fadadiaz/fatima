// Visor de imágenes a pantalla completa, compartido por la galería y los proyectos (marcado en Visor.astro)
import { enmascarar } from './mascara'

type Gsap = typeof import('gsap').gsap

export interface ImagenVisor {
  src: string // miniatura o póster, visible hasta que carga la grande o arranca el video
  grande: string
  zoom?: string // versión más grande disponible, se carga al ampliar
  anchoZoom?: number // ancho en px de esa versión: limita la escala del zoom
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
const ZOOM_MAX = 2.5 // escala máxima del zoom respecto de la caja de la imagen
const PASO_TECLADO = 80 // px que mueven las flechas con zoom
const UMBRAL_ARRASTRE = 4 // px de movimiento para que un clic cuente como arrastre

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
    // Sin zoom en las animaciones, también cuando muestran solo el póster
    if (dato.video) capa.classList.add('visor-capa-video')

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

  // Zoom: transform sobre la capa actual (escala desde su centro y desplazamiento), sin tocar el layout
  let zoom = { activo: false, escala: 1, x: 0, y: 0 }
  let arrastre: { puntero: number; x: number; y: number; desdeX: number; desdeY: number; movio: boolean } | null = null
  let ignorarClic = false

  const conZoom = (capa: HTMLElement | null): capa is HTMLElement => !!capa && !capa.classList.contains('visor-capa-video')
  const tiempoZoom = () =>
    movimientoReducido.matches ? 0 : parseFloat(getComputedStyle(visor!).getPropertyValue('--visor-zoom-tiempo')) || 400

  // Imagen como botón de zoom; los videos no lo son
  function actualizarBoton() {
    if (!conZoom(capaActual())) {
      ;['role', 'tabindex', 'aria-label', 'aria-pressed'].forEach((atributo) => medio!.removeAttribute(atributo))
      return
    }
    medio!.setAttribute('role', 'button')
    medio!.tabIndex = 0
    medio!.setAttribute('aria-label', zoom.activo ? 'Reducir imagen' : 'Ampliar imagen')
    medio!.setAttribute('aria-pressed', String(zoom.activo))
  }

  // Desplazamiento dentro de los bordes: la imagen ampliada siempre cubre la pantalla;
  // en el eje en que es más chica que la pantalla, queda centrada
  function encajar(x: number, y: number, escala: number) {
    const caja = medio!.getBoundingClientRect()
    const eje = (valor: number, tamano: number, centro: number, pantalla: number) => {
      const mitad = (tamano * escala) / 2
      if (mitad * 2 <= pantalla) return pantalla / 2 - centro
      return Math.min(mitad - centro, Math.max(pantalla - mitad - centro, valor))
    }
    return {
      x: eje(x, caja.width, caja.left + caja.width / 2, visor!.clientWidth),
      y: eje(y, caja.height, caja.top + caja.height / 2, visor!.clientHeight),
    }
  }

  function aplicarZoom(capa: HTMLElement, animado: boolean) {
    capa.classList.toggle('zoom-animado', animado && tiempoZoom() > 0)
    capa.style.transform = zoom.activo ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.escala})` : ''
  }

  // Versión más grande encima de la actual, con el mismo fundido que la grande
  function cargarZoom(capa: HTMLElement) {
    const dato = imagenes[indiceActual]
    if (!dato.zoom || dato.zoom === dato.grande || capa.querySelector('.visor-zoom')) return
    const img = document.createElement('img')
    img.className = 'visor-grande visor-zoom'
    img.alt = ''
    img.setAttribute('aria-hidden', 'true')
    img.draggable = false
    img.src = dato.zoom
    img.decode().then(
      () => img.classList.add('cargada'),
      () => {}
    )
    capa.append(img)
  }

  // Amplía desde un punto de la pantalla, que queda en su lugar salvo que haga falta para no mostrar los bordes;
  // sin punto, desde el centro
  function ampliar(capa: HTMLElement, puntoX?: number, puntoY?: number) {
    const dato = imagenes[indiceActual]
    const caja = medio!.getBoundingClientRect()
    const escala = Math.max(1, Math.min(ZOOM_MAX, (dato.anchoZoom ?? dato.ancho) / caja.width))
    const centroX = caja.left + caja.width / 2
    const centroY = caja.top + caja.height / 2
    const destino = encajar(
      ((puntoX ?? centroX) - centroX) * (1 - escala),
      ((puntoY ?? centroY) - centroY) * (1 - escala),
      escala
    )
    zoom = { activo: true, escala, ...destino }
    capa.classList.add('ampliada')
    cargarZoom(capa)
    aplicarZoom(capa, true)
    actualizarBoton()
  }

  function reducir(capa: HTMLElement | null, animado = true) {
    if (!zoom.activo || !capa) return Promise.resolve()
    zoom = { activo: false, escala: 1, x: 0, y: 0 }
    arrastre = null
    capa.classList.remove('ampliada', 'arrastrando')
    aplicarZoom(capa, animado)
    actualizarBoton()
    const espera = animado ? tiempoZoom() : 0
    return new Promise<void>((resolver) => window.setTimeout(resolver, espera))
  }

  function mover(capa: HTMLElement, x: number, y: number, animado: boolean) {
    const destino = encajar(x, y, zoom.escala)
    zoom.x = destino.x
    zoom.y = destino.y
    aplicarZoom(capa, animado)
  }

  function alternarZoom(puntoX?: number, puntoY?: number) {
    const capa = capaActual()
    if (!abierto || animando || !conZoom(capa)) return
    if (zoom.activo) reducir(capa)
    else ampliar(capa, puntoX, puntoY)
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
    zoom = { activo: false, escala: 1, x: 0, y: 0 }
    actualizarBoton()
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
    if (zoom.activo) {
      animando = true
      await reducir(saliente)
      animando = false
    }
    indiceActual = (indiceActual + paso + N) % N
    const dato = imagenes[indiceActual]
    const entrante = crearCapa(dato)

    if (!saliente || movimientoReducido.matches) {
      // Cambio instantáneo
      liberar(saliente)
      medio!.style.setProperty('--ratio', proporcion(dato))
      medio!.append(entrante)
      actualizarBoton()
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
    actualizarBoton()
    // El contenedor pasa a la caja de la nueva imagen al terminar; no tiene nada visible, así que no se nota
    medio!.style.setProperty('--ratio', proporcion(dato))
    animaciones.forEach((animacion) => animacion.cancel())
    reproducir(entrante)
    animando = false
  }

  function cerrar() {
    if (!abierto || animando) return
    if (zoom.activo) {
      // Primero sale del zoom, así la imagen vuelve a su lugar con su caja
      animando = true
      reducir(capaActual()).then(() => {
        animando = false
        cerrar()
      })
      return
    }
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

  // Clic o toque sobre la imagen: alterna el zoom; sobre un video, cierra
  medio.addEventListener('click', (e) => {
    if (!conZoom(capaActual())) return cerrar()
    if (ignorarClic) {
      ignorarClic = false
      return
    }
    alternarZoom(e.clientX, e.clientY)
  })

  // Arrastre con mouse o dedo, sin inercia
  medio.addEventListener('pointerdown', (e) => {
    ignorarClic = false
    const capa = capaActual()
    if (!zoom.activo || !conZoom(capa) || e.button !== 0) return
    arrastre = { puntero: e.pointerId, x: e.clientX, y: e.clientY, desdeX: zoom.x, desdeY: zoom.y, movio: false }
    medio.setPointerCapture(e.pointerId)
  })
  medio.addEventListener('pointermove', (e) => {
    const capa = capaActual()
    if (!arrastre || e.pointerId !== arrastre.puntero || !conZoom(capa)) return
    const dx = e.clientX - arrastre.x
    const dy = e.clientY - arrastre.y
    if (!arrastre.movio && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return
    arrastre.movio = true
    capa.classList.add('arrastrando')
    mover(capa, arrastre.desdeX + dx, arrastre.desdeY + dy, false)
  })
  const soltar = (e: PointerEvent) => {
    if (!arrastre || e.pointerId !== arrastre.puntero) return
    ignorarClic = arrastre.movio
    arrastre = null
    capaActual()?.classList.remove('arrastrando')
  }
  medio.addEventListener('pointerup', soltar)
  medio.addEventListener('pointercancel', soltar)

  // Rueda del mouse y trackpad: mueven la imagen ampliada
  visor.addEventListener(
    'wheel',
    (e) => {
      const capa = capaActual()
      if (!zoom.activo || !conZoom(capa)) return
      e.preventDefault()
      const factor = e.deltaMode === 1 ? 16 : 1
      mover(capa, zoom.x - e.deltaX * factor, zoom.y - e.deltaY * factor, false)
    },
    { passive: false }
  )

  medio.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    alternarZoom()
  })

  // Escape sale del zoom antes de cerrar el visor
  visor.addEventListener('cancel', (e) => {
    e.preventDefault()
    if (zoom.activo) reducir(capaActual())
    else cerrar()
  })

  const direcciones: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  visor.addEventListener('keydown', (e) => {
    const capa = capaActual()
    if (zoom.activo && conZoom(capa)) {
      if (e.key === 'Escape') {
        e.preventDefault()
        reducir(capa)
        return
      }
      const direccion = direcciones[e.key]
      if (direccion) {
        e.preventDefault()
        mover(capa, zoom.x + direccion[0] * PASO_TECLADO, zoom.y + direccion[1] * PASO_TECLADO, true)
      }
      return
    }
    if (e.key === 'ArrowLeft') vecina(-1)
    if (e.key === 'ArrowRight') vecina(1)
  })

  // Con la ventana redimensionada, la imagen ampliada sigue dentro de sus bordes
  window.addEventListener('resize', () => {
    const capa = capaActual()
    if (zoom.activo && conZoom(capa)) mover(capa, zoom.x, zoom.y, false)
  })

  return {
    abrir,
    abierto: () => abierto,
    origen: () => origen,
  }
}
