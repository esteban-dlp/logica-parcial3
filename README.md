# Mi cuaderno de lógica

Primera parte del proyecto MM3032: interfaz y configuración. React, TypeScript y CSS, ejecutados con Vite. No incluye el analizador sintáctico ni el evaluador semántico.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+ y npm.

```sh
npm install
npm run dev
```

La terminal indica la dirección local. Para verificar TypeScript y generar la versión de producción:

```sh
npm run build
```

## Incluido

- Cuaderno de dos páginas con tres capítulos y adaptación a celular.
- Tema claro por defecto y selector de tema oscuro.
- Alta y eliminación de funciones y predicados con aridades enteras no negativas.
- Dominio finito no vacío, sin elementos repetidos. Los elementos son nombres de texto.
- Tablas de funciones y selección de tuplas para relaciones, paginadas en grupos de ocho.
- Constantes y predicados de aridad cero, usando la tupla vacía `[]`.
- Validación de interpretación: funciones totales, valores dentro del dominio y relaciones no vacías, según el enunciado.
- Editor de fórmulas con botones de símbolos y edición por teclado.
- Asignaciones manuales de variables al dominio.
- Guardado automático de la configuración y el tema en este navegador. El almacenamiento puede ser eliminado por el usuario o por el navegador.

Se carga un modelo de ejemplo al abrir por primera vez. Las fuentes manuscritas se descargan de Google Fonts; si no hay conexión, se utiliza la fuente cursiva disponible en el sistema.

## Integración con las otras partes

`src/modelo.ts` exporta `Configuracion` y `Simbolo`. El estado principal vive en `src/Cuaderno.tsx`:

- `dominio`: arreglo de nombres de elementos.
- `simbolos`: nombre, tipo, aridad y tabla de cada símbolo.
- `tabla`: claves de tuplas serializadas con `JSON.stringify`. En una función, el valor es la salida; en un predicado, `true` indica pertenencia. Una entrada ausente en un predicado no pertenece a la relación; una entrada ausente en una función está pendiente.
- `formula`: texto del editor.
- `entorno`: objeto con asignaciones de nombres de variables a elementos del dominio.

La parte 2 debe analizar `formula`, reportar errores, construir el árbol sintáctico e identificar variables libres. La parte 3 debe evaluar el árbol con la interpretación y el entorno, y devolver un resultado con su justificación. El botón «Comprobar» permanece deshabilitado hasta esa integración: no hay resultados simulados.

Al cambiar el dominio se conservan únicamente las tuplas, salidas y asignaciones que siguen siendo válidas. Al eliminar un símbolo se elimina su tabla; para cambiar su nombre o aridad se vuelve a declarar.

Las tablas demasiado grandes para indexarse con precisión numérica muestran un aviso y no se generan. La paginación evita construir el producto cartesiano completo en memoria.

## Verificaciones de configuración

Con Node.js 22.18+ o Node.js 24:

```sh
node --test pruebas/modelo.test.ts
```

No se inicializó un repositorio ni se crearon commits.
# logica-parcial3
