import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { cambiarDominio, errorSimbolo, leerDominio, recuperarConfiguracion, tuplaEn, validarConfiguracion } from './modelo';
import type { Configuracion, Simbolo } from './modelo';
import { analizarFormula } from './analizador';
import type { Formula, Termino } from './analizador';

const claveGuardado = 'cuaderno-logica-v1';
const capitulos = ['Lenguaje', 'Interpretación', 'Evaluación'];

function leerGuardado(clave: string) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function Rama({ nodo }: { nodo: Formula | Termino }) {
  let etiqueta: string;
  let hijos: (Formula | Termino)[] = [];
  switch (nodo.tipo) {
    case 'variable': etiqueta = nodo.nombre; break;
    case 'funcion':
    case 'predicado': etiqueta = `${nodo.nombre} / ${nodo.argumentos.length}`; hijos = nodo.argumentos; break;
    case 'negacion': etiqueta = '¬'; hijos = [nodo.formula]; break;
    case 'cuantificador': etiqueta = `${nodo.cuantificador}${nodo.variable}`; hijos = [nodo.formula]; break;
    case 'conectivo': etiqueta = nodo.conectivo; hijos = [nodo.izquierda, nodo.derecha]; break;
  }
  return <li><span>{etiqueta}</span>{hijos.length > 0 && <ul>{hijos.map((hijo, indice) => <Rama key={indice} nodo={hijo} />)}</ul>}</li>;
}

export default function Cuaderno() {
  const [configuracion, fijarConfiguracion] = useState(() => recuperarConfiguracion(leerGuardado(claveGuardado)));
  const [oscuro, fijarOscuro] = useState(() => leerGuardado('cuaderno-tema') === 'oscuro');
  const [capitulo, fijarCapitulo] = useState(0);
  const [guardado, fijarGuardado] = useState(true);
  const [nombre, fijarNombre] = useState('');
  const [tipo, fijarTipo] = useState<Simbolo['tipo']>('predicado');
  const [aridad, fijarAridad] = useState('1');
  const [errorLenguaje, fijarErrorLenguaje] = useState('');
  const [textoDominio, fijarTextoDominio] = useState(configuracion.dominio.join(', '));
  const [avisoDominio, fijarAvisoDominio] = useState('');
  const [errorDominio, fijarErrorDominio] = useState('');
  const [seleccion, fijarSeleccion] = useState(configuracion.simbolos[0]?.nombre || '');
  const [paginaTabla, fijarPaginaTabla] = useState(0);
  const [variable, fijarVariable] = useState('');
  const [valor, fijarValor] = useState(configuracion.dominio[0]);
  const [errorEntorno, fijarErrorEntorno] = useState('');
  const editor = useRef<HTMLTextAreaElement>(null);
  const errores = validarConfiguracion(configuracion);
  const simbolo = configuracion.simbolos.find(elemento => elemento.nombre === seleccion) || configuracion.simbolos[0];
  const total = simbolo ? configuracion.dominio.length ** simbolo.aridad : 0;
  const tablaManejable = Number.isSafeInteger(total);
  const inicio = paginaTabla * 8;
  const analisis = useMemo(() => analizarFormula(configuracion.formula, configuracion.simbolos), [configuracion.formula, configuracion.simbolos]);
  const libres = analisis.valido ? analisis.variablesLibres : [];
  const faltantes = libres.filter(nombreVariable => !Object.hasOwn(configuracion.entorno, nombreVariable) || !configuracion.dominio.includes(configuracion.entorno[nombreVariable]));

  useEffect(() => {
    try {
      localStorage.setItem(claveGuardado, JSON.stringify(configuracion));
      fijarGuardado(true);
    } catch { fijarGuardado(false); }
  }, [configuracion]);

  useEffect(() => {
    document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
    try { localStorage.setItem('cuaderno-tema', oscuro ? 'oscuro' : 'claro'); } catch { /* el tema sigue disponible durante la sesion */ }
  }, [oscuro]);

  function actualizar(cambios: Partial<Configuracion>) {
    fijarConfiguracion(actual => ({ ...actual, ...cambios }));
  }

  function agregarSimbolo(evento: FormEvent) {
    evento.preventDefault();
    const nombreLimpio = nombre.trim();
    const error = aridad.trim() === '' ? 'Escribe la aridad.' : errorSimbolo(nombreLimpio, Number(aridad), configuracion.simbolos);
    fijarErrorLenguaje(error);
    if (error) return;
    actualizar({ simbolos: [...configuracion.simbolos, { nombre: nombreLimpio, tipo, aridad: Number(aridad), tabla: {} }] });
    fijarNombre('');
    fijarSeleccion(nombreLimpio);
    fijarPaginaTabla(0);
  }

  function aplicarDominio(evento: FormEvent) {
    evento.preventDefault();
    try {
      const dominio = leerDominio(textoDominio);
      fijarConfiguracion(actual => cambiarDominio(actual, dominio));
      fijarTextoDominio(dominio.join(', '));
      fijarValor(dominio[0]);
      fijarPaginaTabla(0);
      fijarErrorDominio('');
      fijarAvisoDominio('Dominio actualizado. Conservamos las asignaciones que siguen siendo válidas.');
    } catch (error) {
      fijarErrorDominio((error as Error).message);
      fijarAvisoDominio('');
    }
  }

  function asignar(clave: string, salida: string | boolean) {
    if (!simbolo) return;
    const tabla = { ...simbolo.tabla };
    if (salida === false || salida === '') delete tabla[clave];
    else tabla[clave] = salida as string | true;
    actualizar({ simbolos: configuracion.simbolos.map(elemento => elemento.nombre === simbolo.nombre ? { ...elemento, tabla } : elemento) });
  }

  function insertar(signo: string) {
    const campo = editor.current;
    if (!campo) return;
    const posicion = campo.selectionStart;
    actualizar({ formula: configuracion.formula.slice(0, posicion) + signo + configuracion.formula.slice(campo.selectionEnd) });
    requestAnimationFrame(() => { campo.focus(); campo.setSelectionRange(posicion + signo.length, posicion + signo.length); });
  }

  function agregarAsignacion(evento: FormEvent) {
    evento.preventDefault();
    const nombreVariable = variable.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(nombreVariable) || !configuracion.dominio.includes(valor)) {
      fijarErrorEntorno('Escribe una variable y selecciona un elemento del dominio.');
      return;
    }
    actualizar({ entorno: { ...configuracion.entorno, [nombreVariable]: valor } });
    fijarVariable('');
    fijarErrorEntorno('');
  }

  function asignarVariable(nombreVariable: string, valorAsignado: string) {
    const entorno = { ...configuracion.entorno };
    if (valorAsignado) entorno[nombreVariable] = valorAsignado;
    else delete entorno[nombreVariable];
    actualizar({ entorno });
  }

  function revisarError() {
    if (analisis.valido) return;
    editor.current?.focus();
    editor.current?.setSelectionRange(analisis.error.inicio, analisis.error.fin);
  }

  return (
    <div className="escritorio">
      <header className="cabecera">
        <div><p className="etiqueta">MM3032 · Lógica matemática</p><p className="titulo-cuaderno">Mi cuaderno de lógica<span>.</span></p></div>
        <button className="boton-tema" onClick={() => fijarOscuro(!oscuro)} aria-label={oscuro ? 'Activar modo claro' : 'Activar modo oscuro'} aria-pressed={oscuro}>
          <span aria-hidden="true">{oscuro ? '☀' : '☾'}</span> <span>{oscuro ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
      </header>

      <nav className="separadores" aria-label="Capítulos del cuaderno">
        {capitulos.map((titulo, indice) => <button key={titulo} aria-current={capitulo === indice ? 'page' : undefined} onClick={() => fijarCapitulo(indice)}><span>{indice + 1}.</span> {titulo}</button>)}
      </nav>

      <main className="cubierta">
        <div className="pliego" key={capitulo}>
          <article className="hoja izquierda" aria-label="Página izquierda">
            <div className="encabezado-hoja"><span>Lógica matemática</span><span>Apuntes / 0{capitulo + 1}</span></div>

            {capitulo === 0 && <>
              <p className="anotacion">Capítulo uno</p><h1>Las palabras de<br />nuestro lenguaje.</h1>
              <p className="manuscrito">Antes de preguntar, definimos<br />qué símbolos podemos usar.</p>
              <form className="formulario" onSubmit={agregarSimbolo}>
                <label>Nombre del símbolo<input value={nombre} onChange={evento => fijarNombre(evento.target.value)} placeholder="Por ejemplo: Q" required autoComplete="off" /></label>
                <div className="campos-juntos"><label>Tipo<select value={tipo} onChange={evento => fijarTipo(evento.target.value as Simbolo['tipo'])}><option value="predicado">Predicado</option><option value="funcion">Función</option></select></label>
                  <label>Aridad<input type="number" min="0" step="1" value={aridad} onChange={evento => fijarAridad(evento.target.value)} required /></label></div>
                {errorLenguaje && <p className="error" role="alert">{errorLenguaje}</p>}
                <button className="boton-tinta">Añadir al cuaderno +</button>
              </form>
              <p className="nota-lapiz">Aridad = número de argumentos.<br />Una función de aridad 0 es una constante.</p>
            </>}

            {capitulo === 1 && <>
              <p className="anotacion">Capítulo dos</p><h1>Un pequeño<br />universo.</h1>
              <form className="formulario" onSubmit={aplicarDominio}>
                <label>Elementos del dominio D<textarea value={textoDominio} onChange={evento => fijarTextoDominio(evento.target.value)} rows={2} aria-describedby="ayuda-dominio" /></label>
                <p className="ayuda" id="ayuda-dominio">Sepáralos con comas, punto y coma o saltos de línea. Cada elemento es un nombre, por ejemplo: 1, 2, 3.</p>
                <button className="boton-tinta">Aplicar dominio →</button>
                {errorDominio && <p className="error" role="alert">{errorDominio}</p>}
                {avisoDominio && <p className="ayuda" role="status">{avisoDominio}</p>}
              </form>
              <p className="dominio-escrito">D = {'{'}{configuracion.dominio.join(', ')}{'}'}</p>
              <label className="selector-simbolo">Ahora interpreta<select value={simbolo?.nombre || ''} disabled={!simbolo} onChange={evento => { fijarSeleccion(evento.target.value); fijarPaginaTabla(0); }}>
                {!simbolo && <option value="">Primero declara un símbolo</option>}
                {configuracion.simbolos.map(elemento => <option key={elemento.nombre} value={elemento.nombre}>{elemento.nombre} · {elemento.tipo === 'funcion' ? 'Función' : 'Predicado'} / {elemento.aridad}</option>)}
              </select></label>
              <p className="nota-lapiz">Una función necesita una salida para cada entrada. Una relación debe contener al menos una tupla.</p>
            </>}

            {capitulo === 2 && <>
              <p className="anotacion">Capítulo tres</p><h1>Hagamos<br />una pregunta.</h1>
              <label className="editor-formula">Mi fórmula<textarea ref={editor} value={configuracion.formula} onChange={evento => actualizar({ formula: evento.target.value })} rows={2} spellCheck={false} placeholder="Escribe aquí tu fórmula…" aria-invalid={!analisis.valido} aria-describedby="estado-sintaxis" /></label>
              <div className="teclado" aria-label="Insertar símbolo lógico">{['¬', '∧', '∨', '→', '↔', '∀', '∃', '(', ')'].map(signo => <button key={signo} onClick={() => insertar(signo)} aria-label={`Insertar ${signo}`}>{signo}</button>)}</div>
              <div id="estado-sintaxis" aria-live="polite">{analisis.valido ? <p className="nota-lapiz">Sintaxis correcta ✓ · Fórmula {libres.length ? 'abierta' : 'cerrada'}.</p> : <><p className="error">{analisis.error.mensaje} Posición {analisis.error.inicio + 1}.</p><button className="enlace-error" onClick={revisarError}>Revisar en la fórmula ↗</button></>}</div>
              <details className="ayuda-sintaxis"><summary>Cómo se agrupa la fórmula</summary><p className="ayuda">Primero ¬ y los cuantificadores; después ∧, ∨, → y ↔. La implicación agrupa de derecha a izquierda. Usa ∀x (P(x,y) → P(y,x)) para ampliar el alcance del cuantificador. También puedes escribir -&gt; y &lt;-&gt;.</p></details>
              <h2 className="titulo-entorno">Valores de las variables</h2>
              {analisis.valido ? libres.length ? <><p className="ayuda">Variables libres: {libres.join(', ')}. Asígnales un elemento de D.</p><div className="variables-libres">{libres.map(nombreVariable => <label key={nombreVariable}>{nombreVariable} ∈ D<select aria-label={`Valor de ${nombreVariable}`} value={Object.hasOwn(configuracion.entorno, nombreVariable) ? configuracion.entorno[nombreVariable] : ''} onChange={evento => asignarVariable(nombreVariable, evento.target.value)}><option value="">Sin asignar</option>{configuracion.dominio.map(elemento => <option key={elemento}>{elemento}</option>)}</select></label>)}</div><p className="ayuda" aria-live="polite">{faltantes.length ? `Falta asignar: ${faltantes.join(', ')}.` : 'Todas las variables libres tienen un valor. ✓'}</p></> : <p className="nota-lapiz">No hay variables libres. Esta fórmula no necesita un entorno.</p> : <p className="ayuda">Corrige la fórmula para identificar sus variables libres.</p>}
              <details className="asignaciones-adicionales"><summary>Otras asignaciones (opcional)</summary>
              <form onSubmit={agregarAsignacion} className="formulario-entorno"><label>Variable<input value={variable} onChange={evento => fijarVariable(evento.target.value)} placeholder="x" required /></label><label>Valor<select value={valor} onChange={evento => fijarValor(evento.target.value)}>{configuracion.dominio.map(elemento => <option key={elemento}>{elemento}</option>)}</select></label><button aria-label="Añadir asignación" className="boton-pequeno">+</button></form>
              {errorEntorno && <p className="error" role="alert">{errorEntorno}</p>}
              <ul className="asignaciones">{Object.entries(configuracion.entorno).map(([nombreVariable, valorAsignado]) => <li key={nombreVariable}>{nombreVariable} ↦ {valorAsignado}<button aria-label={`Eliminar asignación de ${nombreVariable}`} onClick={() => actualizar({ entorno: Object.fromEntries(Object.entries(configuracion.entorno).filter(([clave]) => clave !== nombreVariable)) })}>×</button></li>)}</ul>
              </details>
            </>}

            <span className="numero-pagina">{capitulo * 2 + 1}</span>
          </article>

          <article className="hoja derecha" aria-label="Página derecha">
            <div className="encabezado-hoja"><span>Observar. Probar. Entender.</span><span>MM3032</span></div>

            {capitulo === 0 && <>
              <p className="anotacion">Nuestro vocabulario</p><h2 className="titulo-grande">Todo comienza<br />con un símbolo.</h2>
              {configuracion.simbolos.length ? <ul className="lista-simbolos">{configuracion.simbolos.map(elemento => <li key={elemento.nombre}><div><strong>{elemento.nombre}</strong><span>{elemento.tipo === 'funcion' ? 'Función' : 'Predicado'} · aridad {elemento.aridad}</span></div><button className="borrar" aria-label={`Eliminar símbolo ${elemento.nombre}`} onClick={() => { actualizar({ simbolos: configuracion.simbolos.filter(actual => actual.nombre !== elemento.nombre) }); fijarPaginaTabla(0); }}>×</button></li>)}</ul> : <p className="manuscrito">Aún no hay símbolos.<br />Añade el primero en la otra página.</p>}
              <div className="recuadro-manual"><p>f(x) → un elemento<br />P(x, y) → verdadero o falso</p></div>
              <p className="anotacion inclinada">Después les damos significado ↗</p>
              <p className="ayuda">Para cambiar un nombre o una aridad, elimina el símbolo y decláralo de nuevo. Esto elimina su interpretación.</p>
            </>}

            {capitulo === 1 && <>
              <p className="anotacion">La interpretación</p><h2 className="titulo-grande">{simbolo ? <>El significado<br />de {simbolo.nombre}.</> : <>Primero, un<br />símbolo.</>}</h2>
              {simbolo && <>
                <p className="ayuda">{simbolo.tipo === 'funcion' ? 'Selecciona una salida para cada entrada.' : 'Marca las tuplas que pertenecen a la relación.'}{simbolo.aridad === 0 && ' La tupla vacía se escribe ().'}</p>
                {!tablaManejable ? <p role="alert" className="error">Esta tabla supera el tamaño que puede mostrar el editor. Reduce la aridad o el dominio.</p> : <>
                  <table className="tabla-interpretacion"><thead><tr><th>Entrada</th><th>{simbolo.tipo === 'funcion' ? 'Salida' : 'Pertenece'}</th></tr></thead><tbody>
                    {Array.from({ length: Math.max(0, Math.min(8, total - inicio)) }, (_, desplazamiento) => {
                      const tupla = tuplaEn(configuracion.dominio, simbolo.aridad, inicio + desplazamiento);
                      const clave = JSON.stringify(tupla);
                      const etiqueta = `${simbolo.nombre}(${tupla.join(', ')})`;
                      return <tr key={clave}><td>{etiqueta}</td><td>{simbolo.tipo === 'funcion' ? <select aria-label={`Salida de ${etiqueta}`} value={typeof simbolo.tabla[clave] === 'string' ? simbolo.tabla[clave] as string : ''} onChange={evento => asignar(clave, evento.target.value)}><option value="">Sin asignar</option>{configuracion.dominio.map(elemento => <option key={elemento}>{elemento}</option>)}</select> : <input type="checkbox" aria-label={`${etiqueta} pertenece a la relación`} checked={simbolo.tabla[clave] === true} onChange={evento => asignar(clave, evento.target.checked)} />}</td></tr>;
                    })}
                  </tbody></table>
                  {total > 8 && <div className="paginacion-tabla"><button aria-label="Tuplas anteriores" disabled={paginaTabla === 0} onClick={() => fijarPaginaTabla(paginaTabla - 1)}>←</button><span>{inicio + 1}–{Math.min(inicio + 8, total)} de {total}</span><button aria-label="Tuplas siguientes" disabled={inicio + 8 >= total} onClick={() => fijarPaginaTabla(paginaTabla + 1)}>→</button></div>}
                  <p className="nota-lapiz">{Object.keys(simbolo.tabla).length} de {total} {simbolo.tipo === 'funcion' ? 'salidas asignadas' : 'tuplas seleccionadas'}.</p>
                </>}
              </>}
              <div className="estado-modelo" aria-live="polite"><h3>{errores.length ? 'Por completar…' : '¡El modelo está listo! ✓'}</h3>{errores.length > 0 && <ul>{errores.map((error, indice) => <li key={indice}>{error}</li>)}</ul>}</div>
            </>}

            {capitulo === 2 && <>
              <p className="anotacion">El análisis</p><h2 className="titulo-grande">{analisis.valido ? <>La pregunta está<br />bien escrita.</> : <>Revisemos<br />la pregunta.</>}</h2>
              {analisis.valido ? <><p className="manuscrito">{libres.length ? `Variables libres: ${libres.join(', ')}.` : 'Todas las variables están ligadas.'}<br />La estructura está lista.</p><details className="arbol-sintactico"><summary>Ver árbol sintáctico</summary><ul aria-label="Árbol sintáctico"><Rama nodo={analisis.arbol} /></ul></details></> : <p className="manuscrito">Corrige el error de la otra página.<br />Después veremos su estructura.</p>}
              <div className="recuadro-manual"><p>{errores.length ? 'Tu interpretación tiene datos pendientes.' : 'Tu interpretación está completa. ✓'}</p></div>
              {analisis.valido && faltantes.length > 0 && <p className="ayuda">Antes de evaluar, falta asignar: {faltantes.join(', ')}.</p>}
              <button className="boton-tinta" disabled aria-describedby="estado-evaluacion">Comprobar →</button>
              <p className="ayuda" id="estado-evaluacion">La fórmula ya puede analizarse. El valor de verdad y su explicación estarán disponibles al integrar el evaluador de la parte 3.</p>
            </>}

            <span className="numero-pagina">{capitulo * 2 + 2}</span>
          </article>
        </div>
      </main>

      <nav className="cambio-pagina" aria-label="Cambiar páginas"><button disabled={capitulo === 0} onClick={() => fijarCapitulo(capitulo - 1)}>← Anterior</button><span aria-live="polite">Páginas {capitulo * 2 + 1}–{capitulo * 2 + 2} de 6</span><button disabled={capitulo === 2} onClick={() => fijarCapitulo(capitulo + 1)}>Siguiente →</button></nav>
      <footer>{guardado ? 'Guardado en este navegador' : 'No se pudo guardar en este navegador. Mantén abierta la página para conservar tus cambios.'}<span>Interfaz y análisis · Partes 1 y 2 de 3</span></footer>
    </div>
  );
}
