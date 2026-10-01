# Laboratorio de Minería de Datos

Aplicación académica en español que estudia regresiones lineales para dólar, glucosa y consumo energético, con resultados reproducibles en Python y una interfaz de análisis y predicción.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API para el artefacto web
- `pnpm --filter @workspace/laboratorio-mineria-datos run dev` — interfaz React/Vite
- `python3 main.py` — regenera análisis, gráficas, informe y modelos `.joblib`
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks y tipos desde OpenAPI
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/laboratorio-mineria-datos run typecheck`
- Las predicciones requieren ejecutar `python3 main.py` después de cambiar los CSV; no se usa una base de datos para el análisis.

## Stack

- pnpm workspaces, React, Vite, TypeScript
- API: Express
- Contrato y hooks: OpenAPI + Orval
- Análisis y entrenamiento: Python, pandas, scikit-learn, joblib, matplotlib

## Where things live

- `artifacts/laboratorio-mineria-datos/src/` — interfaz y tema
- `artifacts/laboratorio-mineria-datos/data/raw/` — CSV del laboratorio
- `artifacts/laboratorio-mineria-datos/analysis/train_models.py` — preparación, evaluación y exportación de modelos
- `artifacts/laboratorio-mineria-datos/analysis/INFORME_CRISP_DM.md` — informe generado
- `artifacts/api-server/data/lab-analysis.json` — resultados que entrega la API
- `artifacts/api-server/src/routes/lab.ts` — endpoints de análisis y predicción
- `lib/api-spec/openapi.yaml` — contrato de la API

## Architecture decisions

- La prueba aleatoria del 20% se reserva para métricas; después se reajusta el modelo de entrega con todas las filas.
- El impacto estandarizado agrupa las columnas internas de cada predictor; es comparativo, no causal.
- Hora y día de semana se codifican cíclicamente para energía y se ingresan como valores 1–24 y 1–7.
- La API lee resultados del archivo generado por el script de análisis y no necesita una base de datos.

## Product

Tres casos CRISP-DM con métricas MSE/RMSE/R², visualizaciones descargables como CSV, interpretación de coeficientes, formularios de predicción, modo oscuro y salida para impresión/PDF.

## User preferences

La interfaz y el informe se presentan en español.

## Gotchas

- Si cambian los CSV, ejecutar `python3 main.py` para regenerar los resultados y modelos antes de usar predicciones.
- La inflación se introduce como porcentaje en la web y se convierte a proporción antes de enviarse a la API.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
