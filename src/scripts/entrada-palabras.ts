// Entrada por palabras de los bloques con data-entrada-palabras, una sola vez
import { enmascarar } from './mascara'

// Altura de la ventana, en porcentaje, que debe alcanzar el borde superior del bloque
const DISPARO = 85

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const entrada = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const limite = entry.rootBounds?.bottom ?? (window.innerHeight * DISPARO) / 100
        if (entry.boundingClientRect.top > limite) return
        entry.target.classList.remove('por-entrar')
        entrada.unobserve(entry.target)
      })
    },
    { rootMargin: `0px 0px -${100 - DISPARO}% 0px` }
  )

  document.querySelectorAll<HTMLElement>('[data-entrada-palabras]').forEach((bloque) => {
    enmascarar(bloque)
    bloque.classList.add('por-entrar')
    entrada.observe(bloque)
  })
}
