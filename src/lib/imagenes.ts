// Anchos y tamaños de las imágenes a todo el ancho del cuerpo de los proyectos.
// Se muestran a 736px como máximo en celular y a 1296px en escritorio; van esos anchos, el doble,
// 480, 800 y 1200, y 1800 para el visor. Astro descarta los mayores que el original.
export const ANCHOS_PROYECTO = [480, 736, 800, 1200, 1296, 1472, 1800, 2592]
export const SIZES_PROYECTO = '(max-width: 768px) calc(100vw - 32px), min(calc(100vw - 96px), 1296px)'
export const CALIDAD_PROYECTO = 80
