// Separa cada .subrayado en sus líneas reales (.sub-linea) para animarlas una tras otra

function partir(elemento: HTMLElement) {
  const texto = elemento.dataset.texto ?? elemento.textContent ?? ''
  elemento.dataset.texto = texto
  elemento.textContent = texto
  elemento.classList.remove('subrayado-partido')
  const nodo = elemento.firstChild
  if (!nodo) return

  // Top de cada palabra, medido con un rango sobre el texto
  const rango = document.createRange()
  const lineas: { inicio: number; fin: number; arriba: number }[] = []
  for (const palabra of texto.matchAll(/\S+/g)) {
    const inicio = palabra.index ?? 0
    const fin = inicio + palabra[0].length
    rango.setStart(nodo, inicio)
    rango.setEnd(nodo, fin)
    const arriba = rango.getClientRects()[0]?.top ?? 0
    const linea = lineas[lineas.length - 1]
    if (linea && Math.abs(arriba - linea.arriba) < 2) linea.fin = fin
    else lineas.push({ inicio, fin, arriba })
  }
  if (lineas.length < 2) return

  elemento.replaceChildren()
  lineas.forEach((linea, i) => {
    const span = document.createElement('span')
    span.className = 'sub-linea'
    span.style.setProperty('--n', String(i))
    span.style.setProperty('--total', String(lineas.length))
    span.textContent = texto.slice(linea.inicio, linea.fin)
    elemento.append(span)
    if (i < lineas.length - 1) elemento.append(' ')
  })
  elemento.classList.add('subrayado-partido')
}

const subrayados = [...document.querySelectorAll<HTMLElement>('.subrayado')]
const actualizar = () => subrayados.forEach(partir)

if (subrayados.length) {
  actualizar()
  document.fonts.ready.then(actualizar)
  let espera: number | undefined
  window.addEventListener('resize', () => {
    window.clearTimeout(espera)
    espera = window.setTimeout(actualizar, 150)
  })
}
