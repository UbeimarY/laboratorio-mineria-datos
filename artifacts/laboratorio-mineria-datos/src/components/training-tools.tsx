import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetLabAnalysisQueryKey, useTrainLabModels } from '@workspace/api-client-react';
import { Activity, AlertCircle, Check, ChevronDown, Download, FileCode2, RefreshCw } from 'lucide-react';
import trainerSource from '../../analysis/train_models.py?raw';

export function TrainingTools() {
  const queryClient = useQueryClient();
  const training = useTrainLabModels({
    mutation: {
      onSuccess: (result) => {
        queryClient.setQueryData(getGetLabAnalysisQueryKey(), result);
      },
    },
  });
  const [sourceOpen, setSourceOpen] = useState(false);

  return (
    <section className="training-tools report-card mb-6" aria-labelledby="training-tools-title" data-testid="panel-training-tools">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#267c75]/10 text-[#267c75] dark:text-[#7bc4af]"><Activity size={17} /></span>
          <div className="min-w-0">
            <p className="eyebrow text-[9px] text-muted-foreground">Reproducción del análisis</p>
            <h2 id="training-tools-title" className="serif mt-0.5 text-[17px]">Entrenar desde los CSV incluidos</h2>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">Vuelve a ajustar los tres modelos y actualiza el informe con la respuesta real del entrenador.</p>
          </div>
        </div>
        <button
          type="button"
          data-testid="button-retrain-models"
          onClick={() => training.mutate({ data: { source: 'included_csv' } })}
          disabled={training.isPending}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-sm bg-[#1d645c] px-3.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#174e48] disabled:cursor-wait disabled:opacity-60 dark:bg-[#267c75] dark:hover:bg-[#31958a]"
        >
          <RefreshCw size={13} className={training.isPending ? 'animate-spin' : ''} />
          {training.isPending ? 'Entrenando los tres casos…' : 'Reentrenar modelos'}
        </button>
      </div>
      {training.isPending && <div role="status" data-testid="status-training-progress" className="border-t report-rule bg-muted/50 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">Leyendo los CSV incluidos, reajustando y evaluando con la partición documentada.</div>}
      {training.isSuccess && <div role="status" data-testid="status-training-success" className="flex items-center gap-2 border-t report-rule bg-[#267c75]/5 px-4 py-2.5 text-[11px] text-[#1d645c] dark:text-[#8dd2bd] sm:px-5"><Check size={14} />Entrenamiento completado. Se actualizó el análisis con los resultados devueltos por el servicio.</div>}
      {training.isError && <div role="alert" data-testid="status-training-error" className="flex items-center gap-2 border-t report-rule bg-red-500/5 px-4 py-2.5 text-[11px] text-red-700 dark:text-red-300 sm:px-5"><AlertCircle size={14} />No fue posible entrenar los modelos. Revisa los CSV incluidos y vuelve a intentarlo.</div>}
      <div className="border-t report-rule px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 text-[10px] text-muted-foreground"><FileCode2 size={13} />Entrenador Python · fuente íntegra del proyecto</span>
          <div className="flex items-center gap-3">
            <a
              data-testid="link-download-trainer"
              href={`data:text/x-python;charset=utf-8,${encodeURIComponent(trainerSource)}`}
              download="train_models.py"
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#267c75] hover:underline dark:text-[#7bc4af]"
            >
              <Download size={12} />Descargar .py
            </a>
            <button type="button" data-testid="button-toggle-trainer-source" onClick={() => setSourceOpen((open) => !open)} aria-expanded={sourceOpen} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
              {sourceOpen ? 'Ocultar fuente' : 'Ver fuente'}<ChevronDown size={12} className={sourceOpen ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
        {sourceOpen && <pre data-testid="content-trainer-source" className="mt-3 max-h-[440px] overflow-auto rounded-sm border report-rule bg-muted/50 p-3 text-[10px] leading-relaxed text-foreground"><code>{trainerSource}</code></pre>}
      </div>
    </section>
  );
}