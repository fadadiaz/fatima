// Text roll por letra en los botones .btn interactivos

const crear = (clase: string, contenido?: string | Node) => {
  const span = document.createElement('span')
  span.className = clase
  if (contenido !== undefined) span.append(contenido)
  return span
}

// Elemento de la ola: una caja que recorta, con la copia 1 en su lugar y la copia 2 debajo
const letra = (indice: number, original: string | Node, copia: string | Node) => {
  const caja = crear('roll-letra')
  caja.style.setProperty('--l', String(indice))
  caja.append(crear('roll-original', original), crear('roll-copia', copia))
  return caja
}

const grupo = (clase: string) => {
  const roll = crear(clase)
  roll.setAttribute('aria-hidden', 'true')
  return roll
}

export function prepararRoll(boton: HTMLElement) {
  if (boton.classList.contains('btn-tag')) return
  const conCorchetes = !boton.matches('.btn-alt, .btn-corchetes')
  let indice = conCorchetes ? 1 : 0

  const procesar = (nodo: Node) => {
    ;[...nodo.childNodes].forEach((hijo) => {
      if (hijo.nodeType === Node.TEXT_NODE) {
        const texto = (hijo.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (!texto) return
        const roll = grupo('roll')
        ;[...texto].forEach((caracter) => roll.append(letra(indice++, caracter, caracter)))
        hijo.replaceWith(crear('roll-lector', texto), roll)
      } else if (hijo instanceof HTMLElement && hijo.matches('i')) {
        const roll = grupo('roll roll-icono')
        roll.append(letra(indice++, hijo.cloneNode(), hijo.cloneNode()))
        hijo.replaceWith(roll)
      } else if (hijo instanceof HTMLElement && !hijo.matches('.roll, .roll-lector')) {
        procesar(hijo)
      }
    })
  }

  procesar(boton)

  // Corchetes como primer y último elemento de la ola, en lugar del ::before y ::after
  if (conCorchetes) {
    const izquierdo = grupo('roll roll-corchete')
    izquierdo.append(letra(0, '[', '['))
    const derecho = grupo('roll roll-corchete')
    derecho.append(letra(indice, ']', ']'))
    boton.prepend(izquierdo)
    boton.append(derecho)
    boton.classList.add('con-roll-corchetes')
  }
}

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll<HTMLElement>('a.btn, button.btn').forEach(prepararRoll)
}
