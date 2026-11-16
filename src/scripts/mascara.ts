// Palabras dentro de una máscara, con su posición en --p; los espacios originales se conservan (saltos con pre-line)
export function enmascarar(elemento: HTMLElement) {
  const partes = (elemento.textContent ?? '').trim().split(/(\s+)/)
  elemento.replaceChildren()
  let indice = 0
  partes.forEach((parte) => {
    if (!parte) return
    if (/^\s+$/.test(parte)) {
      elemento.append(parte)
      return
    }
    const mascara = document.createElement('span')
    mascara.className = 'mascara'
    const texto = document.createElement('span')
    texto.className = 'mascara-texto'
    texto.style.setProperty('--p', String(indice++))
    texto.textContent = parte
    mascara.append(texto)
    elemento.append(mascara)
  })
}
