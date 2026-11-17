import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarFormula } from '../src/evaluador.ts';
import { configuracionInicial } from '../src/modelo.ts';
import type { Configuracion, Simbolo } from '../src/modelo.ts';

function comprobar(formula: string, cambios: Partial<Configuracion> = {}) {
  const resultado = evaluarFormula({ ...structuredClone(configuracionInicial), ...cambios, formula });
  assert.equal(resultado.valido, true, JSON.stringify(resultado));
  if (!resultado.valido) throw new Error(resultado.errores.join(' '));
  return resultado.paso;
}

const constante: Simbolo = { nombre: 'c', tipo: 'funcion', aridad: 0, tabla: { '[]': '2' } };

test('el ejemplo inicial muestra todos los casos del universal y sus testigos', () => {
  const paso = comprobar(configuracionInicial.formula);
  assert.equal(paso.valor, true);
  assert.match(paso.razon, /Comprobación completa/);
  assert.equal(paso.hijos.length, 3);
  paso.hijos.forEach((caso, indice) => {
    assert.equal(caso.valor, true);
    assert.match(caso.expresion, new RegExp(`x = ${indice + 1}`));
    assert.ok(caso.razon.includes(`Testigo: y = ${[2, 3, 1][indice]}`));
  });
});

test('el existencial verdadero identifica un testigo decisivo', () => {
  const paso = comprobar('∃x P(x,c)', { simbolos: [...configuracionInicial.simbolos, constante] });
  assert.equal(paso.valor, true);
  assert.match(paso.razon, /Testigo: x = 1/);
  assert.equal(paso.hijos.length, 1);
  assert.match(paso.hijos[0].razon, /P\(1, 2\) pertenece/);
});

test('el universal falso identifica el primer contraejemplo', () => {
  const paso = comprobar('∀x P(x,c)', { simbolos: [...configuracionInicial.simbolos, constante] });
  assert.equal(paso.valor, false);
  assert.match(paso.razon, /Contraejemplo: x = 2/);
  assert.deepEqual(paso.hijos.map(hijo => hijo.valor), [true, false]);
});

test('el universal verdadero comprueba todo el dominio', () => {
  const paso = comprobar('∀x P(x,f(x))');
  assert.equal(paso.valor, true);
  assert.equal(paso.hijos.length, 3);
  assert.match(paso.razon, /Comprobación completa/);
  assert.match(paso.hijos[0].razon, /f\(x\) = 2/);
});

test('el existencial falso comprueba todo el dominio', () => {
  const paso = comprobar('∃x P(x,x)');
  assert.equal(paso.valor, false);
  assert.deepEqual(paso.hijos.map(hijo => hijo.valor), [false, false, false]);
  assert.match(paso.razon, /Comprobación completa/);
});

test('evalua funciones anidadas y explica los valores intermedios', () => {
  const paso = comprobar('P(f(f(c)),c())', { simbolos: [...configuracionInicial.simbolos, constante] });
  assert.equal(paso.valor, true);
  assert.match(paso.razon, /P\(1, 2\) pertenece/);
  assert.match(paso.razon, /c\(\) = 2/);
  assert.match(paso.razon, /f\(c\(\)\) = 3/);
});

test('evalua funciones binarias usando tuplas ordenadas', () => {
  const dominio = configuracionInicial.dominio;
  const funcion: Simbolo = { nombre: 'g', tipo: 'funcion', aridad: 2, tabla: Object.fromEntries(dominio.flatMap(x => dominio.map(y => [JSON.stringify([x, y]), y]))) };
  assert.equal(comprobar('∀x ∀y P(g(x,y),f(y))', { simbolos: [...configuracionInicial.simbolos, funcion] }).valor, true);
});

test('respeta la sombra de variables sin modificar el entorno original', () => {
  const configuracion = { ...structuredClone(configuracionInicial), formula: '(∃x P(x,y)) ∧ P(x,y)', entorno: { x: '2', y: '2' } };
  const antes = structuredClone(configuracion);
  const resultado = evaluarFormula(configuracion);
  assert.equal(resultado.valido, true);
  if (resultado.valido) assert.equal(resultado.paso.valor, false);
  assert.deepEqual(configuracion, antes);
  assert.equal(comprobar('∀x ((∃x P(x,y)) ∧ P(x,y))', { entorno: { y: '2' } }).valor, false);
});

test('los cuantificadores anidados conservan sus entornos independientes', () => {
  assert.equal(comprobar('∀x (P(x,y) → ∃y P(x,y))', { entorno: { y: '2' } }).valor, true);
  assert.equal(comprobar('∃x (P(x,y) ∧ ∀x ∃y P(x,y) ∧ P(x,y))', { entorno: { y: '2' } }).valor, true);
});

test('admite predicados de aridad cero no vacios y su negacion', () => {
  const simbolos: Simbolo[] = [{ nombre: 'A', tipo: 'predicado', aridad: 0, tabla: { '[]': true } }];
  assert.equal(comprobar('A', { simbolos }).valor, true);
  assert.equal(comprobar('¬A()', { simbolos }).valor, false);
});

const atomos: Simbolo[] = ['Q', 'R'].map(nombre => ({ nombre, tipo: 'predicado', aridad: 1, tabla: { '["1"]': true } }));
for (const izquierda of [false, true]) {
  for (const derecha of [false, true]) {
    for (const conectivo of ['∧', '∨', '→', '↔']) {
      test(`tabla de verdad ${izquierda} ${conectivo} ${derecha}`, () => {
        const esperado = conectivo === '∧' ? izquierda && derecha : conectivo === '∨' ? izquierda || derecha : conectivo === '→' ? !izquierda || derecha : izquierda === derecha;
        const paso = comprobar(`Q(x) ${conectivo} R(y)`, { dominio: ['1', '2'], simbolos: atomos, entorno: { x: izquierda ? '1' : '2', y: derecha ? '1' : '2' } });
        assert.equal(paso.valor, esperado);
        const decisiva = (conectivo === '∧' && !izquierda) || (conectivo === '∨' && izquierda) || (conectivo === '→' && !izquierda);
        assert.equal(paso.hijos.length, decisiva ? 1 : 2);
      });
    }
  }
  test(`negacion de ${izquierda}`, () => {
    assert.equal(comprobar('¬Q(x)', { simbolos: [atomos[0]], entorno: { x: izquierda ? '1' : '2' } }).valor, !izquierda);
  });
}

const invalidas: [string, Partial<Configuracion>, RegExp][] = [
  ['P(x)', {}, /necesita 2 argumentos/],
  ['P(x,y)', {}, /Falta asignar/],
  ['P(x,y)', { entorno: { x: '1', y: 'fuera' } }, /Asignación inválida/],
  ['∀x P(x,x)', { dominio: [] }, /dominio no puede estar vacío/],
  ['∀x P(x,x)', { dominio: ['1', '1'] }, /repetidos/],
  ['∀x P(x,x)', { dominio: [''] }, /elementos vacíos/],
  ['∀x P(x,x)', { simbolos: [{ ...configuracionInicial.simbolos[1], tabla: {} }] }, /relación no puede estar vacía/],
  ['∃x ∃y P(x,y)', { simbolos: [{ ...configuracionInicial.simbolos[0], tabla: {} }, configuracionInicial.simbolos[1]] }, /falta asignar una salida/],
  ['∀x P(x,x)', { simbolos: [{ ...configuracionInicial.simbolos[1], tabla: { '["fuera","1"]': true } }] }, /fuera del dominio/],
];

for (const [indice, [formula, cambios, mensaje]] of invalidas.entries()) {
  test(`la entrada invalida ${indice + 1} no recibe valor de verdad`, () => {
    const resultado = evaluarFormula({ ...structuredClone(configuracionInicial), ...cambios, formula });
    assert.equal(resultado.valido, false);
    assert.equal('paso' in resultado, false);
    if (!resultado.valido) assert.match(resultado.errores.join(' '), mensaje);
  });
}

test('rechaza claves de tuplas duplicadas con diferente formato', () => {
  const simbolos = structuredClone(configuracionInicial.simbolos);
  simbolos[0].tabla = { '["1"]': '2', '[ "1" ]': '2', '["3"]': '1' };
  const resultado = evaluarFormula({ ...configuracionInicial, simbolos });
  assert.equal(resultado.valido, false);
  assert.equal('paso' in resultado, false);
});

test('los nombres que coinciden con propiedades de javascript requieren asignacion propia', () => {
  assert.equal(comprobar('P(constructor,y)', { entorno: { constructor: '1', y: '2' } }).valor, true);
  const resultado = evaluarFormula({ ...configuracionInicial, formula: 'P(toString,y)', entorno: { y: '2' } });
  assert.equal(resultado.valido, false);
  if (!resultado.valido) assert.match(resultado.errores.join(' '), /Falta asignar un valor a toString/);
});

test('una comprobacion que supera el limite no devuelve resultados parciales', () => {
  const resultado = evaluarFormula({ dominio: Array.from({ length: 22 }, (_, indice) => String(indice)), simbolos: [{ nombre: 'A', tipo: 'predicado', aridad: 0, tabla: { '[]': true } }], formula: '∀x ∀y ∀z A', entorno: {} });
  assert.equal(resultado.valido, false);
  assert.equal('paso' in resultado, false);
  if (!resultado.valido) assert.match(resultado.errores.join(' '), /supera 10000 pasos/);
});
