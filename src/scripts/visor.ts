// Visor de imágenes a pantalla completa, compartido por la galería y los proyectos (marcado en Visor.astro)
import { enmascarar } from './mascara'

type Gsap = typeof import('gsap').gsap

export interface ImagenVisor {
  src: string // miniatura o póster, visible hasta que carga la grande o arranca el video
  grande: string
  video?: string // MP4 de las animaciones pesadas
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

type Capa = HTMLImageElement | HTMLVideoElement

const ZOOM = 0.6 // s
const DESENFOQUE = 0.4 // s
const EXPANDIDO = { alto: 0.8, ancho: 0.86 } // parte de la ventana que ocupa la imagen abierta
const ESPERA_DECODIFICACION = 400 // ms máximos antes de cambiar de imagen

// Lectura temporal de ?transicion=1, 2 o 3 para comparar las transiciones entre imágenes
const TRANSICION = ['1', '2', '3'].includes(new URLSearchParams(window.location.search).get('transicion') ?? '')
  ? Number(new URLSearchParams(window.location.search).get('transicion'))
  : 1

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

  // Tamaño de la imagen abierta: el mayor que entra en la ventana con su proporción
  function tamanoAbierto(dato: ImagenVisor) {
    const escala = Math.min(
      (window.innerWidth * EXPANDIDO.ancho) / dato.ancho,
      (window.innerHeight * EXPANDIDO.alto) / dato.alto
    )
    return { ancho: dato.ancho * escala, alto: dato.alto * escala }
  }

  const capaActual = () => medio!.querySelector<Capa>('.visor-capa')
  const palabrasTitulo = () => (titulo ? [...titulo.querySelectorAll('.mascara-texto')] : [])

  // Capa de una imagen: video en bucle para las animaciones pesadas (con movimiento reducido, solo el póster)
  function crearCapa(dato: ImagenVisor): Capa {
    if (dato.video && !movimientoReducido.matches) {
      const video = document.createElement('video')
      video.className = 'visor-capa'
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.poster = dato.src
      video.width = dato.ancho
      video.height = dato.alto
      video.setAttribute('role', 'img')
      video.setAttribute('aria-label', dato.alt)
      video.src = dato.video
      return video
    }
    const imagen = document.createElement('img')
    imagen.className = 'visor-capa'
    imagen.alt = dato.alt
    imagen.width = dato.ancho
    imagen.height = dato.alto
    imagen.draggable = false
    imagen.src = dato.src
    // La miniatura se ve hasta que la grande está decodificada
    const grande = new Image()
    grande.src = dato.grande
    grande.decode().then(
      () => {
        imagen.src = dato.grande
      },
      () => {}
    )
    return imagen
  }

  // Espera a que la capa pueda mostrarse, como máximo ESPERA_DECODIFICACION
  function lista(capa: Capa) {
    const tope = new Promise((resolver) => window.setTimeout(resolver, ESPERA_DECODIFICACION))
    const carga =
      capa instanceof HTMLImageElement
        ? capa.decode().catch(() => {})
        : new Promise((resolver) => capa.addEventListener('loadeddata', resolver, { once: true }))
    return Promise.race([carga, tope])
  }

  const reproducir = (capa: Capa | null) => {
    if (capa instanceof HTMLVideoElement) capa.play().catch(() => {})
  }

  // Libera la capa: pausa el video y deja de decodificarlo
  function liberar(capa: Capa | null) {
    if (capa instanceof HTMLVideoElement) {
      capa.pause()
      capa.removeAttribute('src')
      capa.load()
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

  function ajustarTamano() {
    const destino = tamanoAbierto(imagenes[indiceActual])
    const gsap = motor()
    if (gsap) gsap.set(medio, { width: destino.ancho, height: destino.alto })
    else Object.assign(medio!.style, { width: `${destino.ancho}px`, height: `${destino.alto}px` })
  }

  function abrir(boton: HTMLElement, indice: number) {
    if (abierto) return
    abierto = true
    origen = boton
    const caja = boton.getBoundingClientRect()
    indiceActual = (indice + N) % N
    const dato = imagenes[indiceActual]
    liberar(capaActual())
    const capa = crearCapa(dato)
    medio!.append(capa)
    ponerTitulo(dato)
    reproducir(capa)
    const destino = tamanoAbierto(dato)
    const gsap = motor()
    visor!.classList.toggle('sin-motor', !gsap)
    opciones.alAbrir?.()

    if (!gsap) {
      // Fundido con transiciones de CSS
      ajustarTamano()
      Object.assign(medio!.style, { transform: 'translate(-50%, -50%)', opacity: '0' })
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
    gsap.set(medio, { xPercent: -50, yPercent: -50, opacity: 1, scale: 1 })
    gsap.fromTo(
      medio,
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

  // Lee una duración de las variables CSS del visor, en ms
  const duracion = (nombre: string) => parseFloat(getComputedStyle(visor!).getPropertyValue(nombre)) || 0

  // Animaciones de la saliente y la entrante según la opción elegida; solo transform, opacity y clip-path
  function animarCambio(saliente: Capa, entrante: Capa, paso: number) {
    const estilo = getComputedStyle(visor!)
    const curva = estilo.getPropertyValue('--visor-curva').trim() || 'ease'
    const distancia = parseFloat(estilo.getPropertyValue('--visor-distancia')) * (paso > 0 ? 1 : -1)
    const relleno = { fill: 'both' as FillMode }

    if (TRANSICION === 2) {
      // Persiana lateral: la entrante se descubre encima; la saliente se retira al final
      const total = duracion('--visor-persiana')
      const retiro = duracion('--visor-retiro')
      const desde = paso > 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)'
      return [
        entrante.animate({ clipPath: [desde, 'inset(0)'] }, { duration: total, easing: curva, ...relleno }),
        saliente.animate({ opacity: [1, 0] }, { duration: retiro, delay: total - retiro, easing: curva, ...relleno }),
      ]
    }

    if (TRANSICION === 3) {
      // Fundido cruzado
      const total = duracion('--visor-cruzado')
      return [
        saliente.animate({ opacity: [1, 0] }, { duration: total, easing: 'ease-in-out', ...relleno }),
        entrante.animate({ opacity: [0, 1] }, { duration: total, easing: 'ease-in-out', ...relleno }),
      ]
    }

    // Fundido con desplazamiento; con "anterior", las direcciones se invierten
    return [
      saliente.animate(
        { opacity: [1, 0], transform: ['translateX(0)', `translateX(${-distancia}px)`] },
        { duration: duracion('--visor-salida'), easing: curva, ...relleno }
      ),
      entrante.animate(
        { opacity: [0, 1], transform: [`translateX(${distancia}px)`, 'translateX(0)'] },
        { duration: duracion('--visor-entrada'), delay: duracion('--visor-retraso'), easing: curva, ...relleno }
      ),
    ]
  }

  // Imagen vecina en el orden de la lista: las dos capas se apilan centradas, sin recortes ni cambios de tamaño
  async function vecina(paso: number) {
    if (!abierto || animando) return
    const saliente = capaActual()
    const datoSaliente = imagenes[indiceActual]
    indiceActual = (indiceActual + paso + N) % N
    const dato = imagenes[indiceActual]
    const entrante = crearCapa(dato)

    if (!saliente || movimientoReducido.matches) {
      // Cambio instantáneo
      liberar(saliente)
      medio!.append(entrante)
      ajustarTamano()
      ponerTitulo(dato)
      tituloEntra()
      reproducir(entrante)
      return
    }

    animando = true
    if (saliente instanceof HTMLVideoElement) saliente.pause()
    const tamanoSaliente = tamanoAbierto(datoSaliente)
    const tamanoEntrante = tamanoAbierto(dato)
    saliente.classList.add('apilada')
    Object.assign(saliente.style, { width: `${tamanoSaliente.ancho}px`, height: `${tamanoSaliente.alto}px` })
    entrante.classList.add('apilada')
    Object.assign(entrante.style, {
      width: `${tamanoEntrante.ancho}px`,
      height: `${tamanoEntrante.alto}px`,
      opacity: '0',
    })
    medio!.append(entrante)

    const salidaTitulo = tituloSale()
    await lista(entrante)
    entrante.style.opacity = ''
    const animaciones = animarCambio(saliente, entrante, paso)
    if (salidaTitulo) salidaTitulo.eventCallback('onComplete', () => {
      ponerTitulo(dato)
      tituloEntra(0.1)
    })
    else ponerTitulo(dato)

    await Promise.all(animaciones.map((animacion) => animacion.finished.catch(() => {})))
    liberar(saliente)
    // El contenedor toma el tamaño de la nueva imagen recién al terminar; la capa vuelve a ocuparlo entero
    ajustarTamano()
    animaciones.forEach((animacion) => animacion.cancel())
    entrante.classList.remove('apilada')
    entrante.style.width = ''
    entrante.style.height = ''
    reproducir(entrante)
    animando = false
  }

  function cerrar() {
    if (!abierto || animando) return
    const capa = capaActual()
    if (capa instanceof HTMLVideoElement) capa.pause()
    const terminar = (destino: HTMLElement | null) => {
      visor!.close()
      liberar(capaActual())
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
      gsap.to(medio, {
        width: caja.width,
        height: caja.height,
        x: caja.left + caja.width / 2 - window.innerWidth / 2,
        y: caja.top + caja.height / 2 - window.innerHeight / 2,
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
  window.addEventListener('resize', () => {
    if (abierto && !animando) ajustarTamano()
  })

  return {
    abrir,
    abierto: () => abierto,
    origen: () => origen,
  }
}
