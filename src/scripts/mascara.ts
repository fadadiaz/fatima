// Palabras dentro de una máscara, con su posición en --p
export function enmascarar(elemento: HTMLElement) {
  const palabras = (elemento.textContent ?? '').trim().split(/\s+/)
  elemento.replaceChildren()
  palabras.forEach((palabra, i) => {
    const mascara = document.createElement('span')
    mascara.className = 'mascara'
    const texto = document.createElement('span')
    texto.className = 'mascara-texto'
    texto.style.setProperty('--p', String(i))
    texto.textContent = palabra
    mascara.append(texto)
    elemento.append(mascara)
    if (i < palabras.length - 1) elemento.append(' ')
  })
}
