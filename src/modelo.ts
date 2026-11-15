export type Simbolo = {
  nombre: string;
  tipo: 'funcion' | 'predicado';
  aridad: number;
  tabla: Record<string, string | true>;
};

export type Configuracion = {
  dominio: string[];
  simbolos: Simbolo[];
  formula: string;
  entorno: Record<string, string>;
};

export const configuracionInicial: Configuracion = {
  dominio: ['1', '2', '3'],
  simbolos: [
    { nombre: 'f', tipo: 'funcion', aridad: 1, tabla: { '["1"]': '2', '["2"]': '3', '["3"]': '1' } },
    { nombre: 'P', tipo: 'predicado', aridad: 2, tabla: { '["1","2"]': true, '["2","3"]': true, '["3","1"]': true } },
  ],
  formula: '∀x ∃y P(x,y)',
  entorno: {},
};

export function leerDominio(texto: string): string[] {
  const elementos = texto.split(/[,;\n]/).map(elemento => elemento.trim()).filter(Boolean);
  if (!elementos.length) throw new Error('El dominio no puede estar vacío.');
  if (new Set(elementos).size !== elementos.length) throw new Error('Hay elementos repetidos en el dominio.');
  return elementos;
}

export function errorSimbolo(nombre: string, aridad: number, simbolos: Simbolo[]): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(nombre)) return 'Usa una letra inicial y después letras, números o guion bajo.';
  if (simbolos.some(simbolo => simbolo.nombre === nombre)) return 'Ese nombre ya está declarado.';
  if (!Number.isSafeInteger(aridad) || aridad < 0) return 'La aridad debe ser un entero no negativo.';
  return '';
}

export function tuplaEn(dominio: string[], aridad: number, indice: number): string[] {
  const tupla = Array<string>(aridad);
  for (let posicion = aridad - 1; posicion >= 0; posicion--) {
    tupla[posicion] = dominio[indice % dominio.length];
    indice = Math.floor(indice / dominio.length);
  }
  return tupla;
}

function entradaValida(clave: string, valor: unknown, simbolo: Simbolo, dominio: string[]): boolean {
  try {
    const tupla: unknown = JSON.parse(clave);
    return Array.isArray(tupla) && tupla.length === simbolo.aridad
      && tupla.every(elemento => dominio.includes(elemento))
      && (simbolo.tipo === 'funcion' ? typeof valor === 'string' && dominio.includes(valor) : valor === true);
  } catch { return false; }
}

export function cambiarDominio(configuracion: Configuracion, dominio: string[]): Configuracion {
  return {
    ...configuracion,
    dominio,
    simbolos: configuracion.simbolos.map(simbolo => ({
      ...simbolo,
      tabla: Object.fromEntries(Object.entries(simbolo.tabla).filter(([clave, valor]) => entradaValida(clave, valor, simbolo, dominio))),
    })),
    entorno: Object.fromEntries(Object.entries(configuracion.entorno).filter(([, valor]) => dominio.includes(valor))),
  };
}

export function validarConfiguracion(configuracion: Configuracion): string[] {
  const errores: string[] = [];
  if (!configuracion.dominio.length) errores.push('El dominio no puede estar vacío.');
  if (new Set(configuracion.dominio).size !== configuracion.dominio.length) errores.push('El dominio contiene elementos repetidos.');
  configuracion.simbolos.forEach((simbolo, indice) => {
    const error = errorSimbolo(simbolo.nombre, simbolo.aridad, configuracion.simbolos.slice(0, indice));
    if (error) errores.push(`${simbolo.nombre}: ${error}`);
    const entradas = Object.entries(simbolo.tabla);
    if (entradas.some(([clave, valor]) => !entradaValida(clave, valor, simbolo, configuracion.dominio))) {
      errores.push(`${simbolo.nombre}: hay tuplas o valores fuera del dominio.`);
    }
    if (simbolo.tipo === 'funcion' && entradas.length !== configuracion.dominio.length ** simbolo.aridad) {
      errores.push(`${simbolo.nombre}: falta asignar una salida a cada entrada.`);
    }
    if (simbolo.tipo === 'predicado' && !entradas.length) errores.push(`${simbolo.nombre}: la relación no puede estar vacía.`);
  });
  Object.entries(configuracion.entorno).forEach(([variable, valor]) => {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(variable) || !configuracion.dominio.includes(valor)) errores.push(`Asignación inválida para ${variable}.`);
  });
  return errores;
}

export function recuperarConfiguracion(texto: string | null): Configuracion {
  try {
    const dato = JSON.parse(texto || 'null');
    if (!dato || !Array.isArray(dato.dominio) || !dato.dominio.length
      || !dato.dominio.every((elemento: unknown) => typeof elemento === 'string' && elemento.trim())
      || !Array.isArray(dato.simbolos) || typeof dato.formula !== 'string'
      || !dato.entorno || typeof dato.entorno !== 'object' || Array.isArray(dato.entorno)
      || !Object.values(dato.entorno).every(valor => typeof valor === 'string')
      || !dato.simbolos.every((simbolo: Simbolo) => simbolo && typeof simbolo.nombre === 'string'
        && ['funcion', 'predicado'].includes(simbolo.tipo) && Number.isSafeInteger(simbolo.aridad) && simbolo.aridad >= 0
        && simbolo.tabla && typeof simbolo.tabla === 'object' && !Array.isArray(simbolo.tabla)
        && Object.values(simbolo.tabla).every(valor => typeof valor === 'string' || valor === true))) {
      return structuredClone(configuracionInicial);
    }
    return dato;
  } catch { return structuredClone(configuracionInicial); }
}
