import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambiarDominio, configuracionInicial, errorSimbolo, leerDominio, recuperarConfiguracion, tuplaEn, validarConfiguracion } from '../src/modelo.ts';

test('el dominio rechaza vacios y duplicados', () => {
  assert.throws(() => leerDominio(' , ; '));
  assert.throws(() => leerDominio('a, a'));
  assert.deepEqual(leerDominio(' a; b\nc '), ['a', 'b', 'c']);
});

test('el modelo inicial tiene una interpretacion completa', () => {
  assert.deepEqual(validarConfiguracion(configuracionInicial), []);
});

test('el cambio de dominio elimina salidas y asignaciones invalidas', () => {
  const modelo = cambiarDominio({ ...structuredClone(configuracionInicial), entorno: { x: '3', y: '1' } }, ['1', '2']);
  assert.deepEqual(modelo.simbolos[0].tabla, { '["1"]': '2' });
  assert.deepEqual(modelo.simbolos[1].tabla, { '["1","2"]': true });
  assert.deepEqual(modelo.entorno, { y: '1' });
  assert.match(validarConfiguracion(modelo).join(' '), /falta asignar/);
});

test('no se admiten relaciones vacias ni tuplas invalidas', () => {
  const modelo = structuredClone(configuracionInicial);
  modelo.simbolos[1].tabla = {};
  assert.match(validarConfiguracion(modelo).join(' '), /relación no puede estar vacía/);
  modelo.simbolos[1].tabla = { '["4","1"]': true };
  assert.match(validarConfiguracion(modelo).join(' '), /fuera del dominio/);
});

test('las tuplas se generan por indice y admiten aridad cero', () => {
  assert.deepEqual(tuplaEn(['a', 'b'], 3, 5), ['b', 'a', 'b']);
  assert.deepEqual(tuplaEn(['a', 'b'], 0, 0), []);
  const modelo = { dominio: ['a'], simbolos: [
    { nombre: 'c', tipo: 'funcion' as const, aridad: 0, tabla: { '[]': 'a' } },
    { nombre: 'Q', tipo: 'predicado' as const, aridad: 0, tabla: { '[]': true as const } },
  ], formula: '', entorno: {} };
  assert.deepEqual(validarConfiguracion(modelo), []);
});

test('los simbolos requieren nombres unicos y aridades enteras', () => {
  assert.ok(errorSimbolo('P', 2, configuracionInicial.simbolos));
  assert.ok(errorSimbolo('Q', -1, []));
  assert.ok(errorSimbolo('Q', 1.5, []));
  assert.ok(errorSimbolo('2Q', 1, []));
  assert.equal(errorSimbolo('Q', 0, []), '');
});

test('el guardado incompleto se recupera sin romper la aplicacion', () => {
  assert.deepEqual(recuperarConfiguracion('{'), configuracionInicial);
  assert.deepEqual(recuperarConfiguracion('{"dominio":[]}'), configuracionInicial);
  assert.deepEqual(recuperarConfiguracion(JSON.stringify(configuracionInicial)), configuracionInicial);
});
