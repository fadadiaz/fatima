// Text roll por letra en los botones .btn interactivos

const crear = (clase: string, texto?: string) => {
  const span = document.createElement('span')
  span.className = clase
  if (texto !== undefined) span.textContent = texto
  return span
}

export function prepararRoll(boton: HTMLElement) {
  // El link de la página actual conserva su subrayado sin roll
  if (boton.classList.contains('btn-tag') || boton.classList.contains('activo')) return
  let indice = 0

  const procesar = (nodo: Node) => {
    ;[...nodo.childNodes].forEach((hijo) => {
      if (hijo.nodeType === Node.TEXT_NODE) {
        const texto = (hijo.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (!texto) return
        const roll = crear('roll')
        roll.setAttribute('aria-hidden', 'true')
        ;[...texto].forEach((letra) => {
          const caja = crear('roll-letra')
          caja.style.setProperty('--l', String(indice++))
          caja.append(crear('roll-original', letra), crear('roll-copia', letra))
          roll.append(caja)
        })
        hijo.replaceWith(crear('roll-lector', texto), roll)
      } else if (hijo instanceof HTMLElement && !hijo.matches('i, .roll, .roll-lector')) {
        procesar(hijo)
      }
    })
  }

  procesar(boton)
}

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll<HTMLElement>('a.btn, button.btn').forEach(prepararRoll)
}
