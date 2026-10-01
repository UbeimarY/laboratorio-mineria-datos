import type { LabModelAnalysis } from '@workspace/api-client-react';

const fmt = (value: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);

export function DataQualitySummary({ model }: { model: LabModelAnalysis }) {
  const audit = model.data_quality;
  if (!audit) return null;

  const counts = [
    ['Filas duplicadas', audit.duplicate_rows],
    ['Con datos faltantes', audit.missing_rows],
    ['No numéricas', audit.non_numeric_rows],
    ['No finitas', audit.non_finite_rows],
    ['Dominio inválido', audit.invalid_domain_rows],
    ['Celdas normalizadas', audit.normalized_cells],
  ] as const;

  return (
    <section className="data-quality-summary mt-5 rounded-sm border report-rule p-3 sm:p-4" aria-label={`Auditoría de limpieza de ${model.name}`} data-testid={`summary-data-quality-${model.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow text-[8px] text-muted-foreground">Preparación de datos · auditoría</p>
          <h3 className="serif mt-1 text-[17px]">Filas limpias para el modelo</h3>
        </div>
        <p className="mono text-[9px] text-muted-foreground">CSV original: {fmt(audit.input_rows)} · retenidas: {fmt(audit.output_rows)} · excluidas: {fmt(audit.removed_rows)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y report-rule py-3 sm:grid-cols-3">
        {counts.map(([label, value]) => <div key={label} className="min-w-0">
          <dt className="text-[9px] leading-snug text-muted-foreground">{label}</dt>
          <dd className="mono mt-0.5 text-[12px] font-medium">{fmt(value)}</dd>
        </div>)}
      </dl>
      <div className="mt-3 grid grid-cols-1 gap-3 text-[10px] leading-relaxed sm:grid-cols-2">
        <div>
          <p className="eyebrow text-[8px] text-muted-foreground">Política de limpieza</p>
          <p className="mt-1">{audit.policy}</p>
          <p className="mt-1 text-muted-foreground">Se excluyen filas incompletas o inválidas; no se imputan valores. El CSV original se conserva sin modificar.</p>
        </div>
        <div>
          <p className="eyebrow text-[8px] text-muted-foreground">Valores atípicos · IQR</p>
          <p className="mt-1">{audit.outlier_policy}</p>
          <p className="mt-1 text-muted-foreground">Límites calculados con el entrenamiento; los atípicos se conservan. Filas señaladas: {fmt(audit.outlier_train_rows)} en entrenamiento y {fmt(audit.outlier_test_rows)} en prueba.</p>
        </div>
      </div>
      {audit.warnings.length > 0 && <div className="mt-3 border-t report-rule pt-3" role="note" data-testid={`warnings-data-quality-${model.id}`}>
        <p className="eyebrow text-[8px] text-muted-foreground">Advertencias del análisis</p>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] leading-relaxed">
          {audit.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
        </ul>
      </div>}
    </section>
  );
}