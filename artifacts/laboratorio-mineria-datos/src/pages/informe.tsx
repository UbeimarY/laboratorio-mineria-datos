import { useGetLabAnalysis, getGetLabAnalysisQueryKey, type LabModelAnalysis } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { AlertCircle, ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScatterFigure, ImportanceFigure, CorrelationFigure } from '@/components/report/figures';
import { DataQualitySummary } from '@/components/data-quality-summary';

const number = (value: number, digits = 3) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits }).format(value);

function CrispDmDiagram() {
  const steps = [
    ['01', 'Comprensión del problema', 'Dólar · glucosa · energía'],
    ['02', 'Comprensión de los datos', 'CSV incluidos · validación'],
    ['03', 'Preparación y limpieza', 'Auditoría · exclusión · normalización'],
    ['04', 'Transformación y modelado', 'Ciclos · regresión lineal'],
    ['05', 'Evaluación', 'MSE · RMSE · R² en prueba'],
    ['06', 'Despliegue', 'Predicción con modelo final'],
  ];
  return (
    <figure className="report-figure mt-5" data-testid="diagram-crisp-dm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(([numbering, title, detail], index) => <div key={numbering} className="diagram-step relative min-h-[88px] border report-rule px-3 py-3">
          <div className="flex items-center gap-2"><span className="mono text-[9px] text-[#267c75] dark:text-[#7bc4af]">{numbering}</span><span className="text-[11px] font-semibold">{title}</span></div>
          <p className="mt-2 pl-6 text-[10px] text-muted-foreground">{detail}</p>
          {index < steps.length - 1 && <span aria-hidden="true" className="diagram-arrow hidden lg:block">→</span>}
        </div>)}
      </div>
      <figcaption className="mt-2 text-[9px] leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Figura 1.</strong> Secuencia metodológica implementada en el entrenador de este laboratorio.</figcaption>
    </figure>
  );
}

function ModelFlow({ model }: { model: LabModelAnalysis }) {
  return (
    <figure className="model-flow mt-4 rounded-sm border report-rule p-3 sm:p-4" data-testid={`diagram-model-flow-${model.id}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="eyebrow text-[8px] text-muted-foreground">Variables → función → respuesta</span>
        <span className="mono text-[9px] text-muted-foreground">{model.id}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_36px_minmax(110px,.8fr)_36px_minmax(0,1fr)] items-center gap-1">
        <div className="flex flex-wrap gap-1.5">
          {model.feature_impacts.map((impact) => <span key={impact.feature} className="rounded-sm border report-rule px-2 py-1 text-[9px]" title={impact.feature}>{impact.label}</span>)}
        </div>
        <span aria-hidden="true" className="text-center text-[#267c75] dark:text-[#7bc4af]">→</span>
        <div className="border border-[#267c75]/40 bg-[#267c75]/5 px-2 py-2 text-center dark:border-[#7bc4af]/30">
          <p className="text-[10px] font-semibold">Regresión lineal</p>
          <p className="mono mt-1 text-[8px] text-muted-foreground">ajuste múltiple</p>
        </div>
        <span aria-hidden="true" className="text-center text-[#267c75] dark:text-[#7bc4af]">→</span>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-semibold">{model.target}</p>
          <p className="mono mt-1 truncate text-[8px] text-muted-foreground">{model.unit}</p>
        </div>
      </div>
      {model.id === 'energia' && <p className="mt-3 border-t report-rule pt-2 text-[9px] leading-relaxed text-muted-foreground">Hora y día de semana ingresan como ciclos seno/coseno. La amplitud combina los dos componentes de cada variable.</p>}
      <figcaption className="sr-only">Flujo de predicción de {model.name}: {model.feature_impacts.map((feature) => feature.label).join(', ')} alimentan una regresión lineal que estima {model.target}.</figcaption>
    </figure>
  );
}

function ModelResults({ model, base }: { model: LabModelAnalysis; base: number }) {
  const impacts = [...model.feature_impacts].sort((left, right) => right.importance_pct - left.importance_pct);
  return (
    <section className="academic-section" data-testid={`section-report-model-${model.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="serif text-[22px] font-medium">{model.name}</h3>
        <span className="mono text-[9px] text-muted-foreground">{model.data_quality ? `${model.data_quality.output_rows} filas retenidas de ${model.data_quality.input_rows} del CSV` : `${model.row_count} filas retenidas`} · {model.test_row_count} en prueba</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Variable respuesta: <strong className="font-semibold text-foreground">{model.target}</strong> ({model.unit}).</p>
      <DataQualitySummary model={model} />
      <ModelFlow model={model} />
      <p className="mt-1 text-[9px] text-muted-foreground"><strong className="font-semibold text-foreground">Figura {base}.</strong> Flujo de {model.name}: predictores, regresión lineal y variable respuesta.</p>
      <ScatterFigure model={model} number={base + 1} />
      <CorrelationFigure model={model} number={base + 2} />
      <div className="mt-4 overflow-x-auto">
        <table className="academic-table w-full min-w-[470px] border-collapse text-left text-[10px]" data-testid={`table-report-metrics-${model.id}`}>
          <caption className="sr-only">Métricas de evaluación de {model.name}</caption>
          <thead><tr><th>Métrica</th><th>Valor en prueba</th><th>Lectura</th></tr></thead>
          <tbody>
            <tr><th scope="row">MSE</th><td className="mono">{number(model.metrics.mse, 5)}</td><td>Error cuadrático medio, en {model.unit}².</td></tr>
            <tr><th scope="row">RMSE</th><td className="mono">{number(model.metrics.rmse, 5)} {model.unit}</td><td>Magnitud típica del error en unidad original.</td></tr>
            <tr><th scope="row">R²</th><td className="mono">{number(model.metrics.r2, 5)}</td><td>Proporción de variabilidad explicada en datos reservados.</td></tr>
          </tbody>
        </table>
      </div>
      <div className="mt-5">
        <h4 className="eyebrow text-[9px] text-muted-foreground">Coeficientes e importancia comparativa</h4>
        <div className="mt-2 overflow-x-auto">
          <table className="academic-table w-full min-w-[540px] border-collapse text-left text-[10px]" data-testid={`table-report-coefficients-${model.id}`}>
            <caption className="sr-only">Coeficientes e impactos de los predictores en {model.name}</caption>
            <thead><tr><th>Predictor</th><th>Coeficiente / amplitud</th><th>Impacto estandarizado</th><th>Interpretación</th></tr></thead>
            <tbody>
              {impacts.map((impact) => <tr key={impact.feature}>
                <th scope="row">{impact.label}</th>
                <td className="mono">{number(impact.coefficient, 6)}</td>
                <td className="mono">{number(impact.importance_pct, 2)}%</td>
                <td>{impact.interpretation}</td>
              </tr>)}
              <tr><th scope="row">Intercepto</th><td className="mono">{number(model.intercept, 6)}</td><td>—</td><td>Valor base de la ecuación final.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <ImportanceFigure model={model} number={base + 3} />
      <blockquote className="mt-4 border-l-2 border-[#267c75]/50 pl-3 text-[11px] leading-relaxed text-muted-foreground">{model.conclusion}</blockquote>
    </section>
  );
}

export default function Informe() {
  const query = useGetLabAnalysis({ query: { queryKey: getGetLabAnalysisQueryKey(), refetchOnWindowFocus: false } });
  const models = query.data?.models ?? [];

  return (
    <main className="report-page min-h-[100dvh] bg-background px-4 py-5 sm:px-6 sm:py-8">
      <div className="report-sheet mx-auto max-w-[850px]">
        <nav className="report-actions print-hidden mb-5 flex flex-wrap items-center justify-between gap-3" aria-label="Navegación del informe">
          <Link href="/" data-testid="link-back-dashboard" className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#267c75] hover:underline dark:text-[#7bc4af]"><ArrowLeft size={14} />Volver al laboratorio</Link>
          <div className="flex items-center gap-2">
            <button type="button" data-testid="button-refresh-report" onClick={() => query.refetch()} disabled={query.isFetching} className="icon-control inline-flex h-9 items-center gap-2 px-3 text-[10px] disabled:opacity-60"><RefreshCw size={13} className={query.isFetching ? 'animate-spin' : ''} />Actualizar datos</button>
            <button type="button" data-testid="button-print-report" onClick={() => window.print()} disabled={query.isLoading || query.isError || models.length === 0} className="icon-control inline-flex h-9 items-center gap-2 px-3 text-[10px] disabled:opacity-50"><Printer size={13} />Imprimir / Guardar PDF</button>
          </div>
        </nav>

        <article className="academic-document report-card px-5 py-6 sm:px-10 sm:py-10" data-testid="content-academic-report">
          <header className="academic-header border-b-2 border-foreground pb-6">
            <p className="eyebrow text-[9px] text-muted-foreground">Laboratorio de Minería de Datos · Informe técnico</p>
            <h1 className="serif mt-4 max-w-[700px] text-[31px] leading-[1.13] sm:text-[40px]">Modelos de regresión para datos de aula</h1>
            <p className="mt-3 max-w-[640px] text-[12px] leading-relaxed text-muted-foreground">Análisis reproducible de tres conjuntos de datos colombianos mediante el proceso CRISP-DM, con evaluación en datos reservados y lectura de los predictores.</p>
            <div className="mt-6 grid grid-cols-1 gap-3 border-t report-rule pt-4 text-[10px] sm:grid-cols-3">
              <div><p className="eyebrow text-[8px] text-muted-foreground">Autor</p><p className="mt-1 font-semibold" data-testid="text-report-author">Ubeimar Lizardo Yepes Portilla</p></div>
              <div><p className="eyebrow text-[8px] text-muted-foreground">Tipo de trabajo</p><p className="mt-1">Práctica académica · aprendizaje supervisado</p></div>
              <div><p className="eyebrow text-[8px] text-muted-foreground">Datos evaluados</p><p className="mt-1">{query.isSuccess ? `${models.length} modelos · CSV incluidos` : 'Dólar · glucosa · energía'}</p></div>
            </div>
          </header>

          <section className="academic-section">
            <h2 className="eyebrow text-[9px] text-muted-foreground">Resumen</h2>
            <p className="mt-2 text-[12px] leading-[1.8]">Este informe documenta la construcción y evaluación de tres regresiones lineales: cotización del dólar, nivel de glucosa y consumo de energía. Se presentan las variables de entrada, las métricas calculadas sobre el conjunto de prueba, los coeficientes y una lectura comparativa de su impacto. Los valores mostrados provienen del servicio de análisis del laboratorio y se actualizan al reentrenar los modelos con los archivos CSV incluidos.</p>
          </section>

          <section className="academic-section">
            <h2 className="serif text-[22px] font-medium">Método: ciclo CRISP-DM</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">El procedimiento organiza el trabajo desde la pregunta de aula hasta el uso de la estimación. Cada etapa queda conectada con el entrenamiento reproducible que alimenta el reporte.</p>
            <CrispDmDiagram />
            {query.data?.methodology && <dl className="mt-4 grid grid-cols-1 gap-2 border-y report-rule py-3 text-[10px] sm:grid-cols-2">
              <div><dt className="eyebrow text-[8px] text-muted-foreground">Partición</dt><dd className="mt-1" data-testid="text-report-split">{query.data.methodology.train_test_split}</dd></div>
              <div><dt className="eyebrow text-[8px] text-muted-foreground">Semilla aleatoria</dt><dd className="mono mt-1" data-testid="text-report-seed">{query.data.methodology.random_state}</dd></div>
              <div><dt className="eyebrow text-[8px] text-muted-foreground">Codificación periódica</dt><dd className="mt-1" data-testid="text-report-periodic">{query.data.methodology.periodic_encoding}</dd></div>
              <div><dt className="eyebrow text-[8px] text-muted-foreground">Importancia</dt><dd className="mt-1" data-testid="text-report-importance">{query.data.methodology.importance_method}</dd></div>
              {query.data.methodology.cleaning_method && <div className="sm:col-span-2"><dt className="eyebrow text-[8px] text-muted-foreground">Limpieza de datos</dt><dd className="mt-1" data-testid="text-report-cleaning-method">{query.data.methodology.cleaning_method}</dd></div>}
            </dl>}
          </section>

          <section className="academic-section">
            <h2 className="serif text-[22px] font-medium">Resultados y lectura de modelos</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">MSE y RMSE cuantifican el error de predicción; R² resume la varianza explicada en el conjunto de prueba. El impacto estandarizado sirve para contrastar predictores con escalas distintas, pero no establece causalidad. El intercepto y los coeficientes reportados corresponden al modelo final reajustado con todos los registros, tal como implementa el entrenador.</p>
            {query.isLoading || query.isFetching ? <div className="mt-5 space-y-4" role="status" data-testid="status-report-loading"><Skeleton className="h-7 w-1/2" /><Skeleton className="h-40 w-full" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-40 w-full" /></div> : query.isError ? (
              <div role="alert" data-testid="status-report-error" className="mt-5 flex items-start gap-3 rounded-sm border border-red-500/30 bg-red-500/5 p-4 text-[11px] leading-relaxed text-red-800 dark:text-red-200"><AlertCircle className="mt-0.5 shrink-0" size={15} /><div><strong>No se pudo cargar el análisis actual.</strong><p className="mt-1">Use «Actualizar datos» para volver a consultar resultados reales. El informe no sustituye métricas ausentes con valores de ejemplo.</p></div></div>
            ) : models.length === 0 ? (
              <div data-testid="status-report-empty" className="mt-5 border border-dashed report-rule p-5 text-center text-[11px] text-muted-foreground">Aún no hay resultados de entrenamiento publicados para incluir en el informe.</div>
            ) : (
              <div className="mt-5 space-y-7" data-testid="content-report-results">{models.map((model, index) => <ModelResults key={model.id} model={model} base={2 + index * 4} />)}</div>
            )}
          </section>

          <section className="academic-section">
            <h2 className="serif text-[22px] font-medium">Alcances y consideraciones</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[11px] leading-relaxed">
              <li>Los conteos de limpieza se reportan por modelo: las filas incompletas o inválidas se excluyen sin imputación; el CSV original se mantiene intacto. Los valores atípicos se señalan con límites IQR obtenidos solo del entrenamiento y permanecen en el análisis.</li>
              <li>La evaluación se realiza sobre observaciones retenidas y reservadas antes del ajuste del modelo de evaluación, conforme a la partición indicada.</li>
              <li>Después de medir el desempeño, el entrenador vuelve a ajustar una regresión final con los registros disponibles para el uso predictivo.</li>
              <li>En energía, la hora y el día de semana se expresan cíclicamente con componentes seno y coseno; así se conserva la continuidad entre los extremos de cada ciclo.</li>
              <li>Los resultados describen las asociaciones dentro de estos conjuntos de práctica. No prueban relaciones causales ni garantizan extrapolaciones fuera de los rangos observados.</li>
            </ol>
          </section>

          <footer className="mt-8 border-t-2 border-foreground pt-4 text-[9px] text-muted-foreground">
            <div className="flex flex-wrap justify-between gap-2"><span>Laboratorio de Minería de Datos</span><span>Informe generado desde los resultados actuales del modelo</span></div>
          </footer>
        </article>
      </div>
    </main>
  );
}