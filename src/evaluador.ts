import { analizarFormula } from './analizador.ts';
import type { Formula, Termino } from './analizador';
import { validarConfiguracion } from './modelo.ts';
import type { Configuracion } from './modelo';

export type PasoEvaluacion = {
  expresion: string;
  valor: boolean;
  razon: string;
  hijos: PasoEvaluacion[];
};

export type ResultadoEvaluacion =
  | { valido: true; paso: PasoEvaluacion }
  | { valido: false; errores: string[] };

function escribirTermino(termino: Termino): string {
  return termino.tipo === 'variable' ? termino.nombre : `${termino.nombre}(${termino.argumentos.map(escribirTermino).join(', ')})`;
}

function escribirFormula(formula: Formula): string {
  switch (formula.tipo) {
    case 'predicado': return `${formula.nombre}(${formula.argumentos.map(escribirTermino).join(', ')})`;
    case 'negacion': return `¬(${escribirFormula(formula.formula)})`;
    case 'cuantificador': return `${formula.cuantificador}${formula.variable} (${escribirFormula(formula.formula)})`;
    case 'conectivo': return `(${escribirFormula(formula.izquierda)} ${formula.conectivo} ${escribirFormula(formula.derecha)})`;
  }
}

export function evaluarFormula(configuracion: Configuracion): ResultadoEvaluacion {
  const analisis = analizarFormula(configuracion.formula, configuracion.simbolos);
  if (!analisis.valido) return { valido: false, errores: [`${analisis.error.mensaje} Posición ${analisis.error.inicio + 1}.`] };
  const errores = validarConfiguracion(configuracion);
  for (const variable of analisis.variablesLibres) {
    if (!Object.hasOwn(configuracion.entorno, variable)) errores.push(`Falta asignar un valor a ${variable}.`);
  }
  if (errores.length) return { valido: false, errores };

  const lenguaje = new Map(configuracion.simbolos.map(simbolo => [simbolo.nombre, simbolo]));
  let pasos = 0;

  function contarPaso() {
    if (++pasos > 10000) throw new Error('La evaluación supera 10000 pasos. Reduce el dominio o la fórmula. No se obtuvo un valor de verdad.');
  }

  function evaluarTermino(termino: Termino, entorno: Record<string, string>, calculos: string[]): string {
    contarPaso();
    let valor: string;
    if (termino.tipo === 'variable') {
      if (!Object.hasOwn(entorno, termino.nombre) || !configuracion.dominio.includes(entorno[termino.nombre])) throw new Error(`La variable ${termino.nombre} no tiene un valor válido.`);
      valor = entorno[termino.nombre];
    } else {
      const entradas = termino.argumentos.map(argumento => evaluarTermino(argumento, entorno, calculos));
      const salida = lenguaje.get(termino.nombre)!.tabla[JSON.stringify(entradas)];
      if (typeof salida !== 'string' || !configuracion.dominio.includes(salida)) throw new Error(`Falta una salida válida para ${termino.nombre}(${entradas.join(', ')}).`);
      valor = salida;
    }
    calculos.push(`${escribirTermino(termino)} = ${valor}`);
    return valor;
  }

  function resolver(formula: Formula, entorno: Record<string, string>): PasoEvaluacion {
    contarPaso();
    const paso = (valor: boolean, razon: string, hijos: PasoEvaluacion[] = []): PasoEvaluacion => ({ expresion: escribirFormula(formula), valor, razon, hijos });
    switch (formula.tipo) {
      case 'predicado': {
        const calculos: string[] = [];
        const entradas = formula.argumentos.map(argumento => evaluarTermino(argumento, entorno, calculos));
        const valor = lenguaje.get(formula.nombre)!.tabla[JSON.stringify(entradas)] === true;
        const sustituciones = [...new Set(calculos)].join('; ');
        return paso(valor, `${formula.nombre}(${entradas.join(', ')}) ${valor ? 'pertenece' : 'no pertenece'} a la relación.${sustituciones ? ` Sustituciones: ${sustituciones}.` : ''}`);
      }
      case 'negacion': {
        const hijo = resolver(formula.formula, entorno);
        return paso(!hijo.valor, `La negación invierte ${hijo.valor ? 'verdadero' : 'falso'}.`, [hijo]);
      }
      case 'conectivo': {
        const izquierda = resolver(formula.izquierda, entorno);
        if (formula.conectivo === '∧' && !izquierda.valor) return paso(false, 'La izquierda es falsa; basta para refutar ∧. Se omite la derecha.', [izquierda]);
        if (formula.conectivo === '∨' && izquierda.valor) return paso(true, 'La izquierda es verdadera; basta para satisfacer ∨. Se omite la derecha.', [izquierda]);
        if (formula.conectivo === '→' && !izquierda.valor) return paso(true, 'Antecedente falso: implicación verdadera. Se omite el consecuente.', [izquierda]);
        const derecha = resolver(formula.derecha, entorno);
        const hijos = [izquierda, derecha];
        switch (formula.conectivo) {
          case '∧': return paso(derecha.valor, derecha.valor ? 'Ambas subfórmulas son verdaderas.' : 'La derecha es falsa: conjunción falsa.', hijos);
          case '∨': return paso(derecha.valor, derecha.valor ? 'La derecha es verdadera: disyunción verdadera.' : 'Ambas subfórmulas son falsas.', hijos);
          case '→': return paso(derecha.valor, derecha.valor ? 'Antecedente y consecuente verdaderos.' : 'Antecedente verdadero y consecuente falso.', hijos);
          case '↔': return paso(izquierda.valor === derecha.valor, izquierda.valor === derecha.valor ? 'Mismo valor de verdad en ambos lados.' : 'Distinto valor de verdad en cada lado.', hijos);
        }
      }
      case 'cuantificador': {
        const universal = formula.cuantificador === '∀';
        const hijos: PasoEvaluacion[] = [];
        for (const elemento of configuracion.dominio) {
          const caso = resolver(formula.formula, { ...entorno, [formula.variable]: elemento });
          hijos.push({ ...caso, expresion: `${formula.variable} = ${elemento}: ${caso.expresion}` });
          if (caso.valor !== universal) return paso(caso.valor, `${universal ? 'Contraejemplo' : 'Testigo'}: ${formula.variable} = ${elemento}.`, hijos);
        }
        return paso(universal, `Comprobación completa: los ${configuracion.dominio.length} casos son ${universal ? 'verdaderos' : 'falsos'}.`, hijos);
      }
    }
  }

  try {
    return { valido: true, paso: resolver(analisis.arbol, configuracion.entorno) };
  } catch (error) {
    return { valido: false, errores: [error instanceof RangeError ? 'La fórmula está demasiado anidada para evaluarla. Reduce la profundidad.' : (error as Error).message] };
  }
}
