import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarFormula } from '../src/analizador.ts';
import { configuracionInicial } from '../src/modelo.ts';
import type { Simbolo } from '../src/modelo.ts';

const simbolos: Simbolo[] = [
  ...configuracionInicial.simbolos,
  ...['Q', 'R'].map(nombre => ({ nombre, tipo: 'predicado' as const, aridad: 1, tabla: {} })),
  ...['A', 'B', 'C', 'constructor'].map(nombre => ({ nombre, tipo: 'predicado' as const, aridad: 0, tabla: {} })),
  { nombre: 'c', tipo: 'funcion', aridad: 0, tabla: {} },
  { nombre: 'g', tipo: 'funcion', aridad: 2, tabla: {} },
];

function analizar(texto: string) {
  const resultado = analizarFormula(texto, simbolos);
  assert.equal(resultado.valido, true, JSON.stringify(resultado));
  if (!resultado.valido) throw new Error(resultado.error.mensaje);
  return resultado;
}

test('construye el arbol del ejemplo inicial y detecta que es cerrado', () => {
  const resultado = analizar(configuracionInicial.formula);
  assert.deepEqual(resultado.variablesLibres, []);
  assert.deepEqual(resultado.arbol, {
    tipo: 'cuantificador', cuantificador: '∀', variable: 'x', formula: {
      tipo: 'cuantificador', cuantificador: '∃', variable: 'y', formula: {
        tipo: 'predicado', nombre: 'P', argumentos: [{ tipo: 'variable', nombre: 'x' }, { tipo: 'variable', nombre: 'y' }],
      },
    },
  });
});

test('admite funciones anidadas y constantes con o sin parentesis', () => {
  assert.deepEqual(analizar('P(g(f(x),c),c())').variablesLibres, ['x']);
  assert.deepEqual(analizar('A ∧ B()').variablesLibres, []);
});

test('identifica variables libres dentro de terminos y las ordena sin repetir', () => {
  assert.deepEqual(analizar('P(g(z,y), f(z)) ∨ Q(x)').variablesLibres, ['x', 'y', 'z']);
});

test('respeta el alcance local de cuantificadores y variables repetidas', () => {
  assert.deepEqual(analizar('P(x,y) ∧ ∀x P(x,z)').variablesLibres, ['x', 'y', 'z']);
  assert.deepEqual(analizar('∀x (P(x,y) ∧ ∃y P(x,y))').variablesLibres, ['y']);
  assert.deepEqual(analizar('∀x ∃x P(x,y)').variablesLibres, ['y']);
});

test('los parentesis amplian el alcance del cuantificador', () => {
  assert.deepEqual(analizar('∀x Q(x) → R(x)').variablesLibres, ['x']);
  assert.deepEqual(analizar('∀x (Q(x) → R(x))').variablesLibres, []);
});

test('respeta la precedencia de los conectivos', () => {
  const arbol = analizar('¬A ∧ B ∨ C → A ↔ B').arbol;
  assert.equal(arbol.tipo, 'conectivo');
  if (arbol.tipo !== 'conectivo') return;
  assert.equal(arbol.conectivo, '↔');
  assert.equal(arbol.izquierda.tipo, 'conectivo');
  if (arbol.izquierda.tipo !== 'conectivo') return;
  assert.equal(arbol.izquierda.conectivo, '→');
  const disyuncion = arbol.izquierda.izquierda;
  assert.equal(disyuncion.tipo, 'conectivo');
  if (disyuncion.tipo !== 'conectivo') return;
  assert.equal(disyuncion.conectivo, '∨');
  const conjuncion = disyuncion.izquierda;
  assert.equal(conjuncion.tipo, 'conectivo');
  if (conjuncion.tipo !== 'conectivo') return;
  assert.equal(conjuncion.conectivo, '∧');
  assert.equal(conjuncion.izquierda.tipo, 'negacion');
});

test('la implicacion agrupa por la derecha y admite escritura con teclado', () => {
  const arbol = analizar('A -> B -> C').arbol;
  assert.equal(arbol.tipo, 'conectivo');
  if (arbol.tipo !== 'conectivo') return;
  assert.equal(arbol.conectivo, '→');
  assert.equal(arbol.derecha.tipo, 'conectivo');
  assert.deepEqual(analizar('A <-> B').arbol, analizar('A ↔ B').arbol);
  assert.equal(analizar('(A → B) → C').arbol.tipo, 'conectivo');
});

test('ignora espacios y saltos de linea y conserva identificadores completos', () => {
  assert.deepEqual(analizar(' ∀x1\n P(x1, otro_nombre) ').variablesLibres, ['otro_nombre']);
  assert.equal(analizar('constructor').arbol.tipo, 'predicado');
  assert.deepEqual(analizar('P(toString,constructorVariable)').variablesLibres, ['constructorVariable', 'toString']);
});

const invalidas: [string, RegExp][] = [
  ['', /Escribe una fórmula/],
  ['P(x)', /necesita 2 argumentos; recibió 1/],
  ['P(x,y,z)', /necesita 2 argumentos; recibió 3/],
  ['P(f(),y)', /f necesita 1 argumentos; recibió 0/],
  ['P(c(x),y)', /c necesita 0 argumentos; recibió 1/],
  ['Desconocido(x)', /predicado Desconocido no está declarado/],
  ['P(h(x),y)', /función h no está declarada/],
  ['f(x)', /es una función/],
  ['P(Q(x),y)', /es un predicado/],
  ['∀P Q(x)', /ya es un símbolo del lenguaje/],
  ['∀ Q(x)', /ya es un símbolo del lenguaje/],
  ['∀', /Se esperaba un nombre/],
  ['A ∧', /incompleta/],
  ['¬', /incompleta/],
  ['(A ∨ B', /Se esperaba «\)»/],
  ['A)', /No se esperaba «\)»/],
  ['P(x,)', /Se esperaba un nombre/],
  ['P(x y)', /Se esperaba «\)»/],
  ['A B', /No se esperaba «B»/],
  ['A ∧ ∨ B', /Se esperaba un nombre/],
  ['P(x,2)', /Declara una función de aridad 0/],
  ['A @ B', /No se reconoce el carácter/],
];

for (const [texto, mensaje] of invalidas) {
  test(`rechaza la formula invalida ${JSON.stringify(texto)}`, () => {
    const resultado = analizarFormula(texto, simbolos);
    assert.equal(resultado.valido, false);
    if (resultado.valido) return;
    assert.match(resultado.error.mensaje, mensaje);
    assert.ok(resultado.error.inicio >= 0 && resultado.error.fin <= texto.length);
    assert.equal('arbol' in resultado, false);
  });
}

test('los errores apuntan al simbolo o al final que necesita correccion', () => {
  const desconocido = analizarFormula('¬Q(x)', configuracionInicial.simbolos);
  assert.equal(desconocido.valido, false);
  if (!desconocido.valido) assert.deepEqual([desconocido.error.inicio, desconocido.error.fin], [1, 2]);
  const incompleta = analizarFormula('∀x P(x,y', simbolos);
  assert.equal(incompleta.valido, false);
  if (!incompleta.valido) assert.equal(incompleta.error.inicio, '∀x P(x,y'.length);
});

test('el analisis depende del lenguaje pero no modifica su interpretacion', () => {
  const antes = structuredClone(simbolos);
  analizar('∀x P(x,c)');
  assert.deepEqual(simbolos, antes);
  assert.equal(analizarFormula('P(x,y)', []).valido, false);
});
