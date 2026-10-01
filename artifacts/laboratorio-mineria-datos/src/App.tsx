import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter } from 'wouter';
import { getGetLabAnalysisQueryKey, useGetLabAnalysis, usePredictLabValue, type LabModelAnalysis } from '@workspace/api-client-react';
import { CSVLink } from 'react-csv';
import {
  CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownRight, ArrowUpRight, Download, Moon, Printer, RefreshCw, Sun,
  Activity, AlertCircle, ArrowRight, ChevronRight, FileText, FlaskConical, LineChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Informe from '@/pages/informe';
import { TrainingTools } from '@/components/training-tools';
import { DataQualitySummary } from '@/components/data-quality-summary';

type CaseId = 'dolar' | 'glucosa' | 'energia';
type FeatureSpec = { key: string; label: string; unit?: string; min: number; max: number; step: number; initial: number; help?: string };

const CASES: Record<CaseId, { ordinal: string; title: string; deck: string; source: string; accent: string; features: FeatureSpec[] }> = {
  dolar: {
    ordinal: 'CASO 01', title: 'Dólar', deck: '¿Qué variables macroeconómicas acompañan la cotización?', source: 'CSV de práctica · dólar',
    accent: '#b66b32',
    features: [
      { key: 'Dia', label: 'Día del registro', min: 1, max: 500, step: 1, initial: 250 },
      { key: 'Inflacion', label: 'Inflación', unit: '%', min: 0.38, max: 3.93, step: 0.01, initial: 2, help: 'El valor se convierte internamente a la proporción del CSV antes de predecir.' },
      { key: 'Tasa_interes', label: 'Tasa de interés', unit: '%', min: 3.65, max: 6.32, step: 0.01, initial: 5 },
    ],
  },
  glucosa: {
    ordinal: 'CASO 02', title: 'Glucosa', deck: '¿Cómo se relacionan hábitos y medidas corporales con la glucosa?', source: 'CSV de práctica · glucosa',
    accent: '#267c75',
    features: [
      { key: 'Edad', label: 'Edad', unit: 'años', min: 20, max: 79, step: 1, initial: 49 },
      { key: 'IMC', label: 'Índice de masa corporal', unit: 'kg/m²', min: 10.58, max: 39.43, step: 0.01, initial: 25 },
      { key: 'Actividad_Fisica', label: 'Actividad física', unit: 'horas/semana', min: 0, max: 9, step: 1, initial: 5 },
    ],
  },
  energia: {
    ordinal: 'CASO 03', title: 'Energía', deck: '¿Qué condiciones del entorno explican la demanda energética?', source: 'CSV de práctica · energía',
    accent: '#52718b',
    features: [
      { key: 'Temperatura', label: 'Temperatura', unit: '°C', min: 5.39, max: 44.63, step: 0.01, initial: 24.9 },
      { key: 'Hora', label: 'Hora del día', unit: '1–24', min: 1, max: 24, step: 1, initial: 12, help: 'Ingresa el código horario del CSV; la hora se representa como ciclo con seno y coseno.' },
      { key: 'Dia_Semana', label: 'Día de la semana', unit: '1–7', min: 1, max: 7, step: 1, initial: 4, help: '1 = lunes; 7 = domingo. El día también se representa cíclicamente.' },
    ],
  },
};

const CHART_COLORS = { main: '#267c75', warm: '#b66b32', blue: '#52718b' };
const SOURCES = ['Dólar · CSV del laboratorio', 'Glucosa · CSV del laboratorio', 'Energía · CSV del laboratorio'];
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } },
});
const num = (value: number, digits = 2) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits }).format(value);
const safeFilename = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function ScatterPanel({ model, visualization, isDark, color }: {
  model: LabModelAnalysis;
  visualization: LabModelAnalysis['visualizations'][number];
  isDark: boolean;
  color: string;
}) {
  const retainedRows = model.data_quality?.output_rows ?? model.row_count;
  const points = visualization.points.map((point) => ({ predictor: point.x, outcome: point.y }));
  const tick = isDark ? '#a7b3b4' : '#75817e';
  const grid = isDark ? 'rgba(218,230,224,.12)' : '#e4e4dc';
  const exportData = points.map((point) => ({
    [visualization.label]: point.predictor,
    [model.target]: point.outcome,
  }));
  return (
    <section className="scatter-panel" aria-label={`Relación entre ${visualization.label} y ${model.target}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold">{visualization.label}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Predictor frente a {model.target} · muestra de filas retenidas</p>
        </div>
        {points.length > 0 && <CSVLink data={exportData} filename={`${safeFilename(model.name)}-${safeFilename(visualization.label)}.csv`} className="icon-control print:hidden" data-testid={`link-export-${model.id}-${visualization.feature}`} aria-label={`Descargar CSV de ${visualization.label}`} title="Descargar datos CSV"><Download size={14} /></CSVLink>}
      </div>
      {points.length ? (
        <div className="mt-3 h-[220px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" debounce={0}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="2 5" stroke={grid} />
              <XAxis type="number" dataKey="predictor" name={visualization.label} tick={{ fontSize: 10, fill: tick }} stroke={tick} tickLine={false} axisLine={false} />
              <YAxis type="number" dataKey="outcome" name={model.target} tick={{ fontSize: 10, fill: tick }} stroke={tick} tickLine={false} axisLine={false} width={46} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: isDark ? '#182629' : '#fffefa', border: `1px solid ${isDark ? '#405054' : '#deded4'}`, borderRadius: 3, fontSize: 12 }} formatter={(value: number, name: string) => [num(value, 3), name]} labelFormatter={() => 'Observación'} />
              <Scatter data={points} fill={color} fillOpacity={0.72} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-3 flex h-[220px] items-center justify-center border border-dashed report-rule text-xs text-muted-foreground">Sin puntos disponibles para este predictor.</div>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">{points.length} puntos mostrados · {points.length === 0 ? 'sin puntos disponibles' : points.length < retainedRows ? 'muestra aleatoria con semilla 42, máximo 350' : 'todas las filas retenidas'}; retenidas: {num(retainedRows, 0)} · CSV original: {num(model.data_quality?.input_rows ?? model.row_count, 0)} filas · exportación CSV</p>
    </section>
  );
}

function PredictionForm({ model, spec, onPredict, pending, result, error }: {
  model: LabModelAnalysis; spec: typeof CASES[CaseId]; onPredict: (features: Record<string, number>) => void;
  pending: boolean; result?: { prediction: number; target: string; unit: string } | null; error?: string | null;
}) {
  const bounds = useMemo(() => Object.fromEntries(spec.features.map((field) => {
    const range = model.feature_ranges?.[field.key];
    if (!model.feature_ranges) {
      return [field.key, [field.min, field.max]];
    }
    if (!range || range.length < 2 || !Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[0] > range[1]) {
      return [field.key, [undefined, undefined]];
    }
    const displayScale = model.id === 'dolar' && field.key === 'Inflacion' ? 100 : 1;
    return [field.key, [range[0] * displayScale, range[1] * displayScale]];
  })), [model.feature_ranges, model.id, spec]);
  const initial = useMemo(() => Object.fromEntries(spec.features.map((field) => {
    const [min, max] = bounds[field.key];
    const value = min !== undefined && max !== undefined ? Math.min(max, Math.max(min, field.initial)) : field.initial;
    return [field.key, String(value)];
  })), [bounds, spec]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  useEffect(() => setValues(initial), [initial, model.id]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiValues: Record<string, number> = {};
    for (const field of spec.features) {
      const value = Number(values[field.key]);
      if (values[field.key] === '' || !Number.isFinite(value)) return;
      apiValues[field.key] = value;
    }
    if (model.id === 'dolar') apiValues.Inflacion /= 100;
    onPredict(apiValues);
  };
  return (
    <div className="prediction-box">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[10px] text-[#267c75] dark:text-[#7bc4af]">Explorador de predicción</p>
          <h3 className="serif mt-1 text-[21px] leading-tight">Prueba un escenario</h3>
          <p className="mt-1 max-w-lg text-[12px] text-muted-foreground">Cambia los valores y calcula una estimación con el modelo entrenado.</p>
        </div>
        <span className="mono rounded-sm border report-rule px-2 py-1 text-[10px] text-muted-foreground">TAB · valores · ENTER</span>
      </div>
      <form onSubmit={submit} className="mt-5">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
          {spec.features.map((field, index) => (
            <label key={field.key} className="block">
              <span className="mb-1.5 flex items-center justify-between gap-1 text-[11px] font-semibold">
                {field.label}<kbd className="mono text-[9px] font-normal text-muted-foreground">0{index + 1}</kbd>
              </span>
              <div className="relative">
              <input aria-label={field.label} data-testid={`input-predict-${model.id}-${field.key}`} type="number" name={field.key} min={bounds[field.key][0]} max={bounds[field.key][1]} step={['Dia', 'Edad', 'Hora', 'Dia_Semana'].includes(field.key) ? 1 : 'any'} required value={values[field.key]} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="h-10 w-full rounded-[2px] border border-input bg-background px-3 pr-16 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
                {field.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{field.unit}</span>}
              </div>
              {field.help && <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">{field.help}</span>}
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" data-testid={`button-predict-${model.id}`} disabled={pending} className="h-10 rounded-[2px] bg-[#1d645c] px-4 text-[12px] text-white hover:bg-[#174e48] dark:bg-[#267c75] dark:hover:bg-[#31958a]">
            {pending ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-2 h-3.5 w-3.5" />}
            {pending ? 'Calculando…' : 'Calcular estimación'}
            {!pending && <ArrowRight className="ml-2 h-3.5 w-3.5" />}
          </Button>
          <span className="text-[10px] text-muted-foreground">Límites según los datos retenidos{model.feature_ranges ? '' : ' (referencia heredada)'} · estimación educativa; no sustituye evaluación profesional.</span>
        </div>
      </form>
      {error && <p role="alert" className="mt-4 flex items-center gap-2 rounded-sm border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300"><AlertCircle size={14} />{error}</p>}
      {result && <div data-testid={`result-prediction-${model.id}`} className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t report-rule pt-4 fade-up" aria-live="polite">
        <div><p className="eyebrow text-[9px] text-muted-foreground">Resultado estimado</p><p className="serif mt-1 text-[32px] leading-none text-[#267c75] dark:text-[#7bc4af]">{num(result.prediction, 3)} <span className="font-sans text-[13px] text-muted-foreground">{result.unit}</span></p></div>
        <p className="max-w-[250px] text-right text-[11px] leading-relaxed text-muted-foreground">Salida del modelo para <strong className="font-semibold text-foreground">{result.target}</strong>, con los valores ingresados.</p>
      </div>}
    </div>
  );
}

function CaseSection({ model, isDark, onPredict, pending, prediction, predictionError }: {
  model: LabModelAnalysis; isDark: boolean; onPredict: (id: CaseId, values: Record<string, number>) => void;
  pending: boolean; prediction: { model_id: string; prediction: number; target: string; unit: string } | null; predictionError: string | null;
}) {
  const spec = CASES[model.id];
  const orderedImpacts = [...model.feature_impacts].sort((a, b) => b.importance_pct - a.importance_pct);
  const color = spec.accent;
  const localResult = prediction?.model_id === model.id ? prediction : null;
  return (
    <Card id={model.id} data-testid={`card-model-${model.id}`} className="report-card overflow-hidden">
      <CardHeader className="px-5 pb-3 pt-5 sm:px-7 sm:pt-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="eyebrow mt-1 rounded-sm border px-2 py-1 text-[9px]" style={{ borderColor: `${color}55`, color }}>{spec.ordinal}</span>
            <div>
              <CardTitle className="serif text-[26px] font-medium leading-tight sm:text-[30px]">{model.name || spec.title}</CardTitle>
              <p className="mt-1.5 text-[13px] text-muted-foreground">{spec.deck}</p>
            </div>
          </div>
          <span className="mono rounded-sm bg-muted px-2.5 py-1.5 text-[10px] text-muted-foreground">{num(model.row_count, 0)} retenidas · {num(model.test_row_count, 0)} prueba</span>
        </div>
        <p className="ml-0 mt-4 text-[11px] text-muted-foreground sm:ml-[76px]">{spec.source}</p>
        <DataQualitySummary model={model} />
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-7 sm:pb-7">
        <div className="grid grid-cols-3 border-y report-rule py-4">
          <div className="pr-3">
            <p className="eyebrow text-[9px] text-muted-foreground">MSE</p>
            <p data-testid={`value-mse-${model.id}`} className="mono mt-1 text-[15px] font-medium sm:text-[18px]">{num(model.metrics.mse, 3)}</p>
          </div>
          <div className="border-l report-rule px-3">
            <p className="eyebrow text-[9px] text-muted-foreground">RMSE</p>
            <p data-testid={`value-rmse-${model.id}`} className="mono mt-1 text-[15px] font-medium sm:text-[18px]">{num(model.metrics.rmse, 3)} <span className="font-sans text-[10px] text-muted-foreground">{model.unit}</span></p>
          </div>
          <div className="border-l report-rule pl-3">
            <p className="eyebrow text-[9px] text-muted-foreground">R²</p>
            <p data-testid={`value-r2-${model.id}`} className="mono mt-1 text-[15px] font-medium sm:text-[18px]">{num(model.metrics.r2, 3)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-sm bg-muted/60 px-3.5 py-3">
          <span className="mt-0.5 text-[#267c75] dark:text-[#7bc4af]"><LineChart size={15} /></span>
          <p className="text-[12px] leading-relaxed"><span className="font-semibold">Lectura del modelo. </span>{model.conclusion || 'El ajuste resume las relaciones observadas en los datos de entrenamiento.'}</p>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div><p className="eyebrow text-[9px] text-muted-foreground">01 / Relaciones observadas</p><h3 className="serif mt-1 text-[19px]">Cada predictor, frente al resultado</h3></div>
            <span className="hidden text-[10px] text-muted-foreground sm:block">Una marca = una observación</span>
          </div>
          {model.visualizations.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {model.visualizations.map((visualization) => <ScatterPanel key={visualization.feature} model={model} visualization={visualization} isDark={isDark} color={color} />)}
            </div>
          ) : <div className="rounded-sm border border-dashed report-rule px-4 py-8 text-center text-sm text-muted-foreground">No hay relaciones disponibles para graficar en este momento.</div>}
        </div>

        <div className="mt-8">
          <div className="mb-3">
            <p className="eyebrow text-[9px] text-muted-foreground">02 / Interpretabilidad</p>
            <h3 className="serif mt-1 text-[19px]">Qué mueve la estimación</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">Impacto relativo estandarizado; coeficiente original o amplitud para variables cíclicas.</p>
          </div>
          {orderedImpacts.length ? (
            <div className="divide-y report-rule border-y report-rule">
              {orderedImpacts.map((impact) => {
                const cyclic = impact.direction.toLowerCase().includes('ciclic');
                const positive = impact.direction.toLowerCase().includes('posit') || (!cyclic && impact.coefficient >= 0);
                const width = Math.min(100, Math.max(2, impact.importance_pct));
                return <div key={impact.feature} className="grid grid-cols-[minmax(0,1fr)_70px] gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_110px_110px] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3"><span className="truncate text-[12px] font-semibold">{impact.label}</span><span className="mono text-[10px] text-muted-foreground sm:hidden">{num(impact.importance_pct, 1)}%</span></div>
                    <div className="mt-2 h-[4px] w-full max-w-[430px] overflow-hidden bg-muted"><div className="h-full" style={{ width: `${width}%`, backgroundColor: color }} /></div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{impact.interpretation}</p>
                  </div>
                  <div className="hidden sm:block"><p className="eyebrow text-[8px] text-muted-foreground">Impacto</p><p className="mono mt-1 text-[12px]">{num(impact.importance_pct, 1)}%</p></div>
                  <div className="text-right"><p className="eyebrow text-[8px] text-muted-foreground">{cyclic ? 'Amplitud' : 'Coeficiente'}</p><p className={`mono mt-1 flex items-center justify-end gap-1 text-[12px] ${cyclic ? 'text-muted-foreground' : positive ? 'text-[#267c75] dark:text-[#7bc4af]' : 'text-[#a24d3f] dark:text-[#e28f7f]'}`}>{!cyclic && (positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}{num(impact.coefficient, 4)}</p></div>
                </div>;
              })}
              <div className="grid grid-cols-[minmax(0,1fr)_70px] gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_110px_110px]">
                <div><span className="text-[11px] font-semibold">Intercepto</span><p className="mt-1 text-[10px] text-muted-foreground">Valor base de la ecuación lineal.</p></div>
                <div className="hidden sm:block" />
                <div className="text-right"><p className="eyebrow text-[8px] text-muted-foreground">b₀</p><p className="mono mt-1 text-[12px]">{num(model.intercept, 4)}</p></div>
              </div>
            </div>
          ) : <p className="border-y report-rule py-5 text-sm text-muted-foreground">Los coeficientes aún no están disponibles.</p>}
        </div>
        <div className="mt-8"><PredictionForm model={model} spec={spec} onPredict={(values) => onPredict(model.id, values)} pending={pending} result={localResult} error={predictionError} /></div>
      </CardContent>
    </Card>
  );
}

function Home() {
  const query = useGetLabAnalysis({ query: { queryKey: getGetLabAnalysisQueryKey(), refetchOnWindowFocus: false } });
  const predict = usePredictLabValue();
  const [isDark, setIsDark] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [prediction, setPrediction] = useState<{ model_id: string; prediction: number; target: string; unit: string } | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const loading = query.isLoading || query.isFetching;
  const models = query.data?.models ?? [];
  const caseMap = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const r2Leader = [...models].sort((a, b) => b.metrics.r2 - a.metrics.r2)[0];
  const lastRefreshed = query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : null;
  useEffect(() => { document.documentElement.classList.toggle('dark', isDark); }, [isDark]);
  useEffect(() => {
    if (loading) {
      setIsSpinning(true);
      return undefined;
    }
    else {
      const timer = window.setTimeout(() => setIsSpinning(false), 600);
      return () => window.clearTimeout(timer);
    }
  }, [loading]);
  const runPrediction = (id: CaseId, features: Record<string, number>) => {
    setPredictionError(null);
    predict.mutate({ data: { model_id: id, features } }, {
      onSuccess: (result) => setPrediction(result),
      onError: () => setPredictionError('No fue posible calcular la predicción. Verifica los valores e inténtalo de nuevo.'),
    });
  };
  const summaryBullets = [
    models.length ? `${models.length} casos CRISP-DM convierten los conjuntos de práctica en modelos de regresión interpretables.` : 'El análisis reúne tres preguntas de aula: dólar, glucosa y consumo de energía.',
    r2Leader ? `El mejor ajuste relativo es ${r2Leader.name}, con R² de ${num(r2Leader.metrics.r2, 3)} en datos no usados para entrenar.` : 'Los indicadores de error y ajuste se presentan sobre un conjunto de prueba separado.',
    'Los coeficientes muestran dirección y tamaño; el impacto estandarizado permite comparar predictores en distintas unidades.',
  ];
  return (
    <main className="min-h-[100dvh] bg-background px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[900px]">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="pt-1">
              <div className="mb-3 flex items-center gap-2 text-[#267c75] dark:text-[#7bc4af]"><FlaskConical size={15} strokeWidth={1.8} /><span className="eyebrow text-[9px]">Laboratorio de Minería de Datos</span></div>
              <h1 className="serif max-w-[700px] text-[34px] leading-[1.08] tracking-[-0.035em] sm:text-[42px]">De los datos a una explicación.<br className="hidden sm:block" /> Y de ahí, a una predicción.</h1>
               <p className="mt-3 max-w-[610px] text-[13px] leading-relaxed text-muted-foreground">Tres ejercicios con los conjuntos de práctica para entender qué aprende una regresión, cómo se equivoca y qué podemos preguntar al modelo.</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="eyebrow mr-1 text-[8px] text-muted-foreground">Fuentes</span>
                {SOURCES.map((source) => <span key={source} className="rounded-sm border report-rule px-2 py-1 text-[9px] text-muted-foreground">{source}</span>)}
              </div>
              {lastRefreshed && <p className="mt-3 text-[10px] text-muted-foreground">Actualizado {lastRefreshed}</p>}
            </div>
            <div className="print-hidden flex items-center gap-1.5">
              <Button variant="outline" size="sm" data-testid="button-refresh-analysis" onClick={() => query.refetch()} disabled={loading} className="h-9 gap-2 rounded-[2px] px-3 text-[11px]">
                <RefreshCw size={13} className={isSpinning ? 'animate-spin' : ''} />Actualizar
              </Button>
              <Link href="/informe" data-testid="link-academic-report" className="inline-flex h-9 items-center gap-2 rounded-sm border report-rule px-3 text-[10px] font-semibold text-foreground hover:border-primary/50 hover:text-primary"><FileText size={13} />Informe</Link>
              <button type="button" data-testid="button-print-dashboard" onClick={() => window.print()} className="icon-control h-9 w-9" aria-label="Imprimir o guardar como PDF" title="Imprimir o guardar como PDF"><Printer size={15} /></button>
              <button type="button" data-testid="button-toggle-theme" onClick={() => setIsDark((value) => !value)} className="icon-control h-9 w-9" aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'} title={isDark ? 'Modo claro' : 'Modo oscuro'}>{isDark ? <Sun size={15} /> : <Moon size={15} />}</button>
            </div>
          </div>
        </header>

        <TrainingTools />

        <section className="mb-6" aria-labelledby="executive-title">
          <Card className="report-card overflow-hidden">
            <CardHeader className="px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
              <div className="flex items-center gap-2"><span className="h-5 w-[3px] bg-[#267c75]" /><div><p className="eyebrow text-[9px] text-muted-foreground">Lectura ejecutiva</p><CardTitle id="executive-title" className="serif mt-1 text-[21px] font-medium">Lo que muestran los datos</CardTitle></div></div>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-7 sm:pb-6">
              {loading ? <div className="space-y-3 py-2"><Skeleton className="h-4 w-[92%]" /><Skeleton className="h-4 w-[83%]" /><Skeleton className="h-4 w-[87%]" /></div> : query.isError ? <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><AlertCircle size={15} />No se pudo cargar el análisis. Usa «Actualizar» para reintentar.</div> : models.length === 0 ? <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Activity size={15} />Aún no hay resultados de modelos para mostrar.</div> : (
                <ul className="space-y-3">
                  {summaryBullets.map((item, index) => <li key={index} data-testid={`text-executive-finding-${index + 1}`} className="flex items-start gap-3 text-[12px] leading-relaxed sm:text-[13px]"><span className="mono mt-[1px] text-[10px] text-[#267c75] dark:text-[#7bc4af]">0{index + 1}</span><span>{item}</span></li>)}
                </ul>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t report-rule pt-3 text-[10px] leading-relaxed text-muted-foreground">
                <span className="eyebrow text-[8px]">Evaluación</span>
                <span>Entrenamiento y prueba separados; los indicadores corresponden a {query.data?.methodology.train_test_split || 'un conjunto de prueba reservado'}.</span>
                {query.data?.methodology.random_state !== undefined && <span className="mono">· semilla {query.data.methodology.random_state}</span>}
              </div>
            </CardContent>
          </Card>
        </section>

        <nav className="mb-5 flex flex-wrap gap-2 print-hidden" aria-label="Saltar a un caso">
          {(['dolar', 'glucosa', 'energia'] as CaseId[]).map((id) => <a key={id} data-testid={`link-jump-${id}`} href={`#${id}`} className="group inline-flex items-center gap-2 rounded-sm border report-rule px-3 py-2 text-[11px] transition-colors hover:border-primary/50 hover:text-primary"><span className="mono text-[9px] text-muted-foreground">{CASES[id].ordinal}</span>{CASES[id].title}<ChevronRight size={12} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" /></a>)}
        </nav>

        <div className="space-y-6">
          {loading ? (['a', 'b', 'c'] as const).map((id) => <Card key={id} className="report-card p-5 sm:p-7"><div className="space-y-4"><Skeleton className="h-7 w-44" /><Skeleton className="h-4 w-72" /><Skeleton className="h-16 w-full" /><Skeleton className="h-[230px] w-full" /><Skeleton className="h-40 w-full" /></div></Card>) : query.isError ? (
            <Card className="report-card p-8 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><AlertCircle size={19} /></span>
              <h2 className="serif mt-4 text-xl">El informe no está disponible</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">No pudimos conectar con el servicio de análisis. Conservamos la página lista para volver a intentarlo.</p>
              <Button variant="outline" data-testid="button-retry-analysis" onClick={() => query.refetch()} className="mt-5 rounded-[2px]"><RefreshCw size={14} className="mr-2" />Reintentar</Button>
            </Card>
          ) : models.length === 0 ? (
            <Card className="report-card p-8 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><Activity size={19} /></span>
              <h2 className="serif mt-4 text-xl">Todavía no hay casos publicados</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Cuando los modelos estén listos, aquí aparecerán sus relaciones, métricas y controles de predicción.</p>
            </Card>
          ) : (['dolar', 'glucosa', 'energia'] as CaseId[]).map((id) => {
            const model = caseMap.get(id);
            return model ? <div key={id} className="fade-up"><CaseSection model={model} isDark={isDark} onPredict={runPrediction} pending={predict.isPending} prediction={prediction} predictionError={predictionError} /></div> : (
              <Card key={id} id={id} className="report-card p-6">
                <p className="eyebrow text-[9px] text-muted-foreground">{CASES[id].ordinal} / {CASES[id].title}</p>
                <h2 className="serif mt-2 text-xl">Caso pendiente de publicación</h2>
                <p className="mt-1 text-sm text-muted-foreground">Los resultados de este modelo no están disponibles en esta respuesta del análisis.</p>
              </Card>
            );
          })}
        </div>

        {!loading && models.length > 0 && <footer className="mt-8 border-t report-rule py-5 text-[10px] leading-relaxed text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="eyebrow text-[8px]">Notas de lectura</span><span>CRISP-DM · comprensión, modelado, evaluación y uso</span></div>
          <p className="mt-2 max-w-3xl">MSE y RMSE describen error en la unidad del objetivo al cuadrado y en la unidad original; R² expresa la proporción de variabilidad explicada en prueba. La importancia relativa se estandariza para comparar variables de distinta escala; no implica causalidad.</p>
          {query.data?.methodology.periodic_encoding && <p className="mt-1">Codificación periódica: {query.data.methodology.periodic_encoding}</p>}
          {query.data?.methodology.cleaning_method && <p className="mt-1">Preparación y limpieza: {query.data.methodology.cleaning_method}</p>}
        </footer>}
        <div className="print-hidden mt-5 flex items-center justify-between border-t report-rule py-4 text-[9px] text-muted-foreground"><span>Material académico · Minería de datos</span><span className="mono">CO / LAB 01</span></div>
      </div>
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ErrorBoundary>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/informe" component={Informe} />
              <Route component={NotFound} />
            </Switch>
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;