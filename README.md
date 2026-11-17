# Mi cuaderno de lógica

Proyecto MM3032: interfaz, configuración, análisis sintáctico y evaluación semántica. React, TypeScript y CSS, ejecutados con Vite.

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
- Análisis al escribir, comprobación de símbolos y aridades, errores con posición y árbol sintáctico desplegable.
- Detección de variables libres y selección de sus valores en el dominio. Se conservan las asignaciones manuales en «Otras asignaciones».
- Evaluación de términos, funciones anidadas, predicados, conectivos y cuantificadores con explicaciones desplegables.
- Testigos para existenciales verdaderos, contraejemplos para universales falsos y comprobación completa para universales verdaderos y existenciales falsos.
- Guardado automático de la configuración y el tema en este navegador. El almacenamiento puede ser eliminado por el usuario o por el navegador.

Se carga un modelo de ejemplo al abrir por primera vez. Las fuentes manuscritas se descargan de Google Fonts; si no hay conexión, se utiliza la fuente cursiva disponible en el sistema.

## Integración con las otras partes

`src/modelo.ts` exporta `Configuracion` y `Simbolo`. El estado principal vive en `src/Cuaderno.tsx`:

- `dominio`: arreglo de nombres de elementos.
- `simbolos`: nombre, tipo, aridad y tabla de cada símbolo.
- `tabla`: claves de tuplas serializadas con `JSON.stringify`. En una función, el valor es la salida; en un predicado, `true` indica pertenencia. Una entrada ausente en un predicado no pertenece a la relación; una entrada ausente en una función está pendiente.
- `formula`: texto del editor.
- `entorno`: objeto con asignaciones de nombres de variables a elementos del dominio.

`src/analizador.ts` exporta `analizarFormula(texto, simbolos)`. Devuelve `{ valido: true, arbol, variablesLibres }` o `{ valido: false, error: { mensaje, inicio, fin } }`. Las posiciones empiezan en cero y `fin` es exclusivo, compatibles con la selección de texto del editor. El análisis es independiente de las tablas de interpretación y no modifica la configuración.

El árbol usa los tipos exportados `Formula` y `Termino`. Sus nodos distinguen predicados, funciones, variables, negación, conectivos y cuantificadores. Las funciones de aridad cero representan constantes. `obtenerVariablesLibres(arbol)` también está disponible por separado.

`src/evaluador.ts` exporta `evaluarFormula(configuracion)`. Primero analiza la fórmula, valida toda la interpretación y comprueba que las variables libres tengan valores válidos. Después evalúa el árbol sin modificar la configuración. Devuelve `{ valido: true, paso }` o `{ valido: false, errores }`. Una entrada incorrecta no recibe un valor de verdad.

Cada `PasoEvaluacion` contiene `expresion`, `valor`, `razon` e `hijos`. Los predicados explican las sustituciones y la pertenencia a la relación. Los cuantificadores conservan un entorno independiente por caso, respetando la sombra de variables. La evaluación se detiene al encontrar un testigo existencial o un contraejemplo universal; los otros dos resultados recorren el dominio completo. Conjunción, disyunción e implicación omiten la derecha cuando la izquierda ya determina la respuesta; la explicación lo indica.

«Comprobar» se habilita únicamente cuando la sintaxis, el modelo y las asignaciones están completos. El resultado se retira al modificar cualquier dato de la configuración. Cambiar de capítulo o de tema conserva la comprobación actual, pero los resultados no se guardan entre recargas.

Para mantener la aplicación local manejable, cada evaluación admite hasta 10000 visitas a fórmulas y términos. Si supera ese límite o la profundidad de recursión disponible, muestra un error sin resultado parcial ni valor de verdad. Reduce el dominio o la complejidad de la fórmula para continuar.

## Sintaxis admitida

- Conectivos: `¬`, `∧`, `∨`, `→`, `↔`. Se aceptan `->` y `<->` como alternativas de teclado.
- Cuantificadores: `∀x` y `∃x`, seguidos de una subfórmula. Los nombres de variables no pueden ser símbolos ya declarados.
- Identificadores: una letra inicial, seguida de letras, números o guion bajo. Un identificador sin declarar en un término se interpreta como variable; una función o un predicado debe estar declarado.
- Aplicaciones: `P(x,y)`, `P(f(x),y)`. Los símbolos de aridad cero admiten `c` o `c()` y `A` o `A()`.
- Los elementos del dominio no se escriben directamente como constantes. Para representar el elemento `2`, declara por ejemplo una función `c` de aridad cero, asigna `c() = 2` y escribe `P(x,c)`.
- Precedencia de mayor a menor: negación y cuantificadores, conjunción, disyunción, implicación, bicondicional. La implicación asocia por la derecha; los demás conectivos binarios, por la izquierda.
- El cuantificador abarca la siguiente subfórmula unaria. `∀x Q(x) → R(x)` deja libre la segunda aparición de `x`. Para ligarla también, escribe `∀x (Q(x) → R(x))`.

Ejemplo con el lenguaje inicial: `∀x P(x,y)` tiene la variable libre `y`. `P(x)` es inválida porque `P` tiene aridad 2. Los términos por sí solos no son fórmulas.

Al cambiar el dominio se conservan únicamente las tuplas, salidas y asignaciones que siguen siendo válidas. Al eliminar un símbolo se elimina su tabla; para cambiar su nombre o aridad se vuelve a declarar.

Las tablas demasiado grandes para indexarse con precisión numérica muestran un aviso y no se generan. La paginación evita construir el producto cartesiano completo en memoria.

## Verificaciones

Con Node.js 22.18+ o Node.js 24:

```sh
npm test
```

No se inicializó un repositorio ni se crearon commits.
# logica-parcial3
