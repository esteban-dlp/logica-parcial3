import type { Simbolo } from './modelo';

export type Termino =
  | { tipo: 'variable'; nombre: string }
  | { tipo: 'funcion'; nombre: string; argumentos: Termino[] };

export type Formula =
  | { tipo: 'predicado'; nombre: string; argumentos: Termino[] }
  | { tipo: 'negacion'; formula: Formula }
  | { tipo: 'conectivo'; conectivo: '∧' | '∨' | '→' | '↔'; izquierda: Formula; derecha: Formula }
  | { tipo: 'cuantificador'; cuantificador: '∀' | '∃'; variable: string; formula: Formula };

export type ResultadoAnalisis =
  | { valido: true; arbol: Formula; variablesLibres: string[] }
  | { valido: false; error: { mensaje: string; inicio: number; fin: number } };

type Ficha = { texto: string; inicio: number; fin: number };

class ErrorSintaxis extends Error {
  inicio: number;
  fin: number;

  constructor(mensaje: string, ficha: Ficha) {
    super(mensaje);
    this.inicio = ficha.inicio;
    this.fin = ficha.fin;
  }
}

function separar(texto: string): Ficha[] {
  const fichas: Ficha[] = [];
  let posicion = 0;
  while (posicion < texto.length) {
    if (/\s/.test(texto[posicion])) { posicion++; continue; }
    const coincidencia = /^(<->|->|[A-Za-z][A-Za-z0-9_]*|[¬∧∨→↔∀∃(),])/.exec(texto.slice(posicion));
    if (!coincidencia) {
      const mensaje = /\d/.test(texto[posicion])
        ? 'Los elementos del dominio no son constantes del lenguaje. Declara una función de aridad 0 para usarlos en fórmulas.'
        : `No se reconoce el carácter «${texto[posicion]}».`;
      throw new ErrorSintaxis(mensaje, { texto: texto[posicion], inicio: posicion, fin: posicion + 1 });
    }
    const valor = coincidencia[0];
    fichas.push({ texto: valor === '->' ? '→' : valor === '<->' ? '↔' : valor, inicio: posicion, fin: posicion + valor.length });
    posicion += valor.length;
  }
  fichas.push({ texto: '', inicio: texto.length, fin: texto.length });
  return fichas;
}

export function obtenerVariablesLibres(arbol: Formula): string[] {
  const libres = new Set<string>();

  function visitarTermino(termino: Termino, ligadas: Set<string>) {
    if (termino.tipo === 'variable') {
      if (!ligadas.has(termino.nombre)) libres.add(termino.nombre);
    } else termino.argumentos.forEach(argumento => visitarTermino(argumento, ligadas));
  }

  function visitarFormula(formula: Formula, ligadas: Set<string>) {
    switch (formula.tipo) {
      case 'predicado': formula.argumentos.forEach(argumento => visitarTermino(argumento, ligadas)); break;
      case 'negacion': visitarFormula(formula.formula, ligadas); break;
      case 'conectivo': visitarFormula(formula.izquierda, ligadas); visitarFormula(formula.derecha, ligadas); break;
      case 'cuantificador': visitarFormula(formula.formula, new Set([...ligadas, formula.variable])); break;
    }
  }

  visitarFormula(arbol, new Set());
  return [...libres].sort();
}

export function analizarFormula(texto: string, simbolos: Simbolo[]): ResultadoAnalisis {
  try {
    const fichas = separar(texto);
    const lenguaje = new Map(simbolos.map(simbolo => [simbolo.nombre, simbolo]));
    // Tras un cuantificador, separa una variable del predicado declarado pegado a ella.
    for (let i = 0; i < fichas.length - 1; i++) {
      if (fichas[i].texto !== '∀' && fichas[i].texto !== '∃') continue;
      const ficha = fichas[i + 1];
      const candidatos = simbolos.filter(s => s.tipo === 'predicado' && ficha.texto.endsWith(s.nombre)
        && ficha.texto.length > s.nombre.length
        && (fichas[i + 2]?.texto === '(' || s.aridad === 0)
        && /^[A-Za-z][A-Za-z0-9_]*$/.test(ficha.texto.slice(0, -s.nombre.length)));
      if (candidatos.length > 1) throw new ErrorSintaxis('Esta expresión puede separarse de varias formas. Añade un espacio entre la variable y el predicado.', ficha);
      if (candidatos.length === 1) {
        const corte = ficha.texto.length - candidatos[0].nombre.length;
        fichas.splice(i + 1, 1, { texto: ficha.texto.slice(0, corte), inicio: ficha.inicio, fin: ficha.inicio + corte },
          { texto: ficha.texto.slice(corte), inicio: ficha.inicio + corte, fin: ficha.fin });
      }
    }
    const precedencia: Record<string, number> = { '↔': 1, '→': 2, '∨': 3, '∧': 4 };
    let posicion = 0;
    const actual = () => fichas[posicion];

    function consumir(valor: string) {
      if (actual().texto !== valor) throw new ErrorSintaxis(`Se esperaba «${valor}»${actual().texto ? `, pero se encontró «${actual().texto}»` : ' al final de la fórmula'}.`, actual());
      posicion++;
    }

    function nombre(): Ficha {
      const ficha = actual();
      if (!/^[A-Za-z]/.test(ficha.texto)) throw new ErrorSintaxis('Se esperaba un nombre de variable o símbolo.', ficha);
      posicion++;
      return ficha;
    }

    function argumentos(simbolo: Simbolo, ficha: Ficha): Termino[] {
      const lista: Termino[] = [];
      if (actual().texto === '(') {
        consumir('(');
        if (actual().texto !== ')') {
          lista.push(termino());
          while (actual().texto === ',') { consumir(','); lista.push(termino()); }
        }
        consumir(')');
      }
      if (lista.length !== simbolo.aridad) {
        const ejemplo = simbolo.aridad === 0 ? simbolo.nombre : simbolo.aridad <= 10 ? `${simbolo.nombre}(${Array.from({ length: simbolo.aridad }, (_, i) => `x${i + 1}`).join(',')})` : `${simbolo.nombre}(...)`;
        throw new ErrorSintaxis(`${simbolo.nombre} necesita ${simbolo.aridad} argumentos; recibió ${lista.length}. Por ejemplo: ${ejemplo}.`, ficha);
      }
      return lista;
    }

    function termino(): Termino {
      const ficha = nombre();
      const simbolo = lenguaje.get(ficha.texto);
      if (simbolo?.tipo === 'predicado') throw new ErrorSintaxis(`${ficha.texto} es un predicado; aquí se necesita un término.`, ficha);
      if (simbolo) return { tipo: 'funcion', nombre: simbolo.nombre, argumentos: argumentos(simbolo, ficha) };
      if (actual().texto === '(') throw new ErrorSintaxis(`La función ${ficha.texto} no está declarada.`, ficha);
      return { tipo: 'variable', nombre: ficha.texto };
    }

    function unaria(): Formula {
      if (actual().texto === '¬') { consumir('¬'); return { tipo: 'negacion', formula: unaria() }; }
      if (actual().texto === '∀' || actual().texto === '∃') {
        const cuantificador = actual().texto as '∀' | '∃';
        consumir(cuantificador);
        const variable = nombre();
        if (lenguaje.has(variable.texto)) throw new ErrorSintaxis(`${variable.texto} ya es un símbolo del lenguaje; usa otro nombre para la variable.`, variable);
        return { tipo: 'cuantificador', cuantificador, variable: variable.texto, formula: unaria() };
      }
      if (actual().texto === '(') { consumir('('); const agrupada = formula(); consumir(')'); return agrupada; }
      if (!actual().texto) throw new ErrorSintaxis(texto.trim() ? 'La fórmula está incompleta; falta un predicado o una subfórmula.' : 'Escribe una fórmula para analizarla.', actual());
      const ficha = nombre();
      const simbolo = lenguaje.get(ficha.texto);
      if (!simbolo) throw new ErrorSintaxis(`El predicado ${ficha.texto} no está declarado.`, ficha);
      if (simbolo.tipo !== 'predicado') throw new ErrorSintaxis(`${ficha.texto} es una función; aquí se necesita un predicado.`, ficha);
      return { tipo: 'predicado', nombre: simbolo.nombre, argumentos: argumentos(simbolo, ficha) };
    }

    function formula(minima = 1): Formula {
      let izquierda = unaria();
      while ((precedencia[actual().texto] || 0) >= minima) {
        const conectivo = actual().texto as '∧' | '∨' | '→' | '↔';
        const nivel = precedencia[conectivo];
        consumir(conectivo);
        const derecha = formula(conectivo === '→' ? nivel : nivel + 1);
        izquierda = { tipo: 'conectivo', conectivo, izquierda, derecha };
      }
      return izquierda;
    }

    const arbol = formula();
    if (actual().texto) throw new ErrorSintaxis(`No se esperaba «${actual().texto}»; revisa los conectivos, las comas y los paréntesis.`, actual());
    return { valido: true, arbol, variablesLibres: obtenerVariablesLibres(arbol) };
  } catch (error) {
    if (error instanceof ErrorSintaxis) return { valido: false, error: { mensaje: error.message, inicio: error.inicio, fin: error.fin } };
    if (error instanceof RangeError) return { valido: false, error: { mensaje: 'La fórmula está demasiado anidada para analizarla. Reduce la profundidad.', inicio: 0, fin: texto.length } };
    throw error;
  }
}
