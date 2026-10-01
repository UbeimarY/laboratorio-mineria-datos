import type { LabModelAnalysis } from '@workspace/api-client-react';

const fmt = (value: number, digits = 2) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits }).format(value);
const fmtTick = (value: number) => {
  const abs = Math.abs(value);
  return fmt(value, abs >= 1000 ? 0 : abs >= 10 ? 1 : 2);
};

export const SAMPLE_CAP = 350;
export const SAMPLE_SEED = 42;

export const getMatrix = (model: LabModelAnalysis) => model.correlation_matrix;

export function Figure({ number, title, caption, testId, children }: { number: number; title: string; caption: string; testId: string; children: React.ReactNode }) {
  return (
    <figure className="report-figure mt-5 border report-rule p-3 sm:p-4" data-testid={testId}>
      <p className="eyebrow text-[8px] text-muted-foreground">Figura {number}</p>
      <p className="mt-1 text-[11px] font-semibold">{title}</p>
      <div className="mt-3">{children}</div>
      <figcaption className="mt-3 border-t report-rule pt-2 text-[9px] leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Figura {number}.</strong> {caption}</figcaption>
    </figure>
  );
}

function ScatterPanel({ model, viz, letter }: { model: LabModelAnalysis; viz: LabModelAnalysis['visualizations'][number]; letter: string }) {
  const pts = viz.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const W = 300, H = 230, L = 46, R = 10, T = 10, B = 40;
  if (pts.length === 0) return <div className="border border-dashed report-rule p-4 text-center text-[10px] text-muted-foreground">Sin puntos para {viz.label}.</div>;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const sx = (v: number) => L + ((v - minX) / spanX) * (W - L - R);
  const sy = (v: number) => H - B - ((v - minY) / spanY) * (H - B - T);
  const n = pts.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const slope = sxx > 0 ? sxy / sxx : 0, icpt = my - slope * mx;
  const ticks = [0, 0.5, 1];
  const id = `scatter-${model.id}-${viz.feature}`;
  return (
    <div className="min-w-0" data-testid={`figure-scatter-${model.id}-${viz.feature}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
        <title id={`${id}-t`}>Dispersión de {viz.label} frente a {model.target}</title>
        <desc id={`${id}-d`}>Muestra de {n} puntos de {model.data_quality?.output_rows ?? model.row_count} filas retenidas tras la limpieza, de {model.data_quality?.input_rows ?? model.row_count} filas del CSV. Valores de {viz.label} entre {fmtTick(minX)} y {fmtTick(maxX)}; {model.target} entre {fmtTick(minY)} y {fmtTick(maxY)} {model.unit}. La recta es una tendencia univariada descriptiva.</desc>
        <defs><clipPath id={`${id}-clip`}><rect x={L} y={T} width={W - L - R} height={H - B - T} /></clipPath></defs>
        {ticks.map((t) => <g key={t}>
          <line x1={L} x2={W - R} y1={sy(minY + t * spanY)} y2={sy(minY + t * spanY)} stroke="hsl(var(--border))" strokeWidth="0.7" />
          <text x={L - 5} y={sy(minY + t * spanY) + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="var(--app-font-mono)">{fmtTick(minY + t * spanY)}</text>
          <text x={sx(minX + t * spanX)} y={H - B + 13} textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="var(--app-font-mono)">{fmtTick(minX + t * spanX)}</text>
        </g>)}
        <line x1={L} x2={L} y1={T} y2={H - B} stroke="hsl(var(--foreground))" strokeWidth="0.8" />
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="hsl(var(--foreground))" strokeWidth="0.8" />
        {pts.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.2" fill="#267c75" fillOpacity="0.45" />)}
        {sxx > 0 && <line clipPath={`url(#${id}-clip)`} x1={sx(minX)} y1={sy(icpt + slope * minX)} x2={sx(maxX)} y2={sy(icpt + slope * maxX)} stroke="#c8742f" strokeWidth="1.6" strokeDasharray="5 3" />}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))">{viz.label}</text>
        <text x="10" y={(T + H - B) / 2} textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))" transform={`rotate(-90 10 ${(T + H - B) / 2})`}>{model.unit}</text>
      </svg>
      <p className="mt-1 text-[9px] text-muted-foreground">({letter}) {viz.label} vs. {model.target}</p>
    </div>
  );
}

export function ScatterFigure({ model, number }: { model: LabModelAnalysis; number: number }) {
  const vizs = model.visualizations ?? [];
  const shown = vizs.length ? Math.max(...vizs.map((v) => v.points.length)) : 0;
  const retainedRows = model.data_quality?.output_rows ?? model.row_count;
  const inputRows = model.data_quality?.input_rows ?? model.row_count;
  return (
    <Figure number={number} testId={`figure-scatter-set-${model.id}`} title={`Cada predictor frente a ${model.target}`}
      caption={`Dispersión de ${vizs.length} predictores. Se muestran hasta ${shown} puntos de las ${retainedRows} filas retenidas para el modelo (CSV original: ${inputRows} filas): ${shown >= retainedRows ? 'el conjunto limpio completo' : `muestra determinista con semilla ${SAMPLE_SEED}, máximo ${SAMPLE_CAP} puntos`}. La recta discontinua es una tendencia lineal univariada y descriptiva calculada solo sobre los puntos mostrados; no es la predicción del modelo múltiple ni incluye incertidumbre.`}>
      {vizs.length === 0 ? <div className="border border-dashed report-rule p-4 text-center text-[10px] text-muted-foreground">El servicio no entregó puntos de dispersión para este modelo.</div> :
        <div className="report-scatter-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{vizs.map((v, i) => <ScatterPanel key={v.feature} model={model} viz={v} letter={String.fromCharCode(97 + i)} />)}</div>}
    </Figure>
  );
}

export function ImportanceFigure({ model, number }: { model: LabModelAnalysis; number: number }) {
  const impacts = [...model.feature_impacts].sort((a, b) => b.importance_pct - a.importance_pct);
  return (
    <Figure number={number} testId={`figure-importance-${model.id}`} title="Impacto estandarizado relativo por predictor"
      caption="Participación porcentual calculada por el entrenador a partir de los coeficientes estandarizados del modelo final. Compara predictores con escalas distintas; no indica causalidad.">
      <ul className="space-y-2" aria-label={`Importancia de predictores en ${model.name}`}>
        {impacts.map((i) => <li key={i.feature} className="grid grid-cols-[minmax(80px,30%)_1fr_auto] items-center gap-2 text-[10px]">
          <span className="min-w-0 break-words">{i.label}</span>
           <span className="block h-3 border report-rule" aria-hidden="true"><span className="importance-bar block h-full" style={{ width: `${Math.max(0, Math.min(100, i.importance_pct))}%` }} /></span>
          <span className="mono">{fmt(i.importance_pct, 2)}%</span>
        </li>)}
      </ul>
    </Figure>
  );
}

const cellColor = (v: number | null) => {
  if (v === null || !Number.isFinite(v)) return 'transparent';
  const a = Math.min(1, Math.abs(v)) * 0.8;
  return v >= 0 ? `rgba(38,124,117,${a})` : `rgba(200,116,47,${a})`;
};

export function CorrelationFigure({ model, number }: { model: LabModelAnalysis; number: number }) {
  const m = getMatrix(model);
   const valid = m && m.labels.length > 0 && m.features.length === m.labels.length && m.values.length === m.labels.length && m.values.every((row) => row.length === m.labels.length);
  return (
    <Figure number={number} testId={`figure-correlation-${model.id}`} title={`Matriz de correlación de Pearson: ${model.name}`}
      caption={`Correlación de Pearson calculada sobre las ${m?.row_count ?? model.data_quality?.output_rows ?? model.row_count} filas retenidas tras la limpieza, de ${model.data_quality?.input_rows ?? model.row_count} filas del CSV original, a partir de los valores originales. Escala de -1 (inversa) a 1 (directa). Advertencia: Pearson sobre códigos crudos de hora o día de semana no puede representar asociaciones cíclicas, por lo que puede subestimarlas.`}>
      {!valid ? <div className="border border-dashed report-rule p-4 text-center text-[10px] text-muted-foreground" data-testid={`status-correlation-empty-${model.id}`}>La matriz de correlación no está disponible en la respuesta actual del servicio.</div> : <>
        <div className="overflow-x-auto">
          <table className="corr-table w-full border-collapse text-[9px]">
            <caption className="sr-only">Matriz de correlación de Pearson de {model.name}, escala de -1 a 1</caption>
            <thead><tr><td />{m.labels.map((l, i) => <th key={m.features[i] ?? i} scope="col" className="px-1 pb-1 align-bottom font-semibold">{l}</th>)}</tr></thead>
            <tbody>{m.values.map((row, r) => <tr key={m.features[r] ?? r}>
              <th scope="row" className="pr-2 text-left font-semibold">{m.labels[r]}</th>
              {row.map((v, c) => <td key={c} className="mono corr-cell h-10 border border-card text-center" style={{ background: cellColor(v) }}>{v === null ? 'n/d' : fmt(v, 2)}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[8px] text-muted-foreground mono" aria-label="Escala de color de -1 a 1">
          <span>-1</span><span className="corr-scale h-2 flex-1 border report-rule" aria-hidden="true" /><span>1</span>
        </div>
      </>}
    </Figure>
  );
}
