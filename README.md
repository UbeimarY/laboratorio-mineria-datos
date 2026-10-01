# Laboratorio de Minería de Datos

Aplicación académica en español para estudiar tres modelos de regresión lineal —dólar, glucosa y consumo de energía— mediante CRISP-DM. Presenta métricas sobre datos de prueba, relaciones entre variables, interpretación de coeficientes y un formulario para generar predicciones.

## Ejecutar el análisis

Requisitos: Python 3.11 o posterior y las dependencias de `artifacts/laboratorio-mineria-datos/analysis/requirements.txt`.

```bash
python3 -m pip install -r artifacts/laboratorio-mineria-datos/analysis/requirements.txt
python3 main.py
```

Los tres CSV originales de práctica están en `artifacts/laboratorio-mineria-datos/data/raw/`. El análisis:

- valida que los predictores y objetivos estén presentes y sean numéricos;
- evalúa con una partición aleatoria 80/20 y `random_state=42`;
- codifica hora y día de semana como variables periódicas para el caso de energía;
- reporta MSE, RMSE y R² en el conjunto de prueba;
- vuelve a ajustar cada modelo con todos los datos para exportarlo como `.joblib`;
- genera el informe CRISP-DM, las gráficas PNG y los resultados consumidos por la API.

Archivos generados:

- `artifacts/laboratorio-mineria-datos/analysis/INFORME_CRISP_DM.md`
- `artifacts/laboratorio-mineria-datos/analysis/models/{dolar,glucosa,energia}.joblib`
- `artifacts/laboratorio-mineria-datos/analysis/figures/{dolar,glucosa,energia}.png`
- `artifacts/api-server/data/lab-analysis.json`

Al cambiar un CSV, vuelve a ejecutar `python3 main.py` antes de probar la aplicación.

## Ejecutar la aplicación

El espacio de trabajo es un monorepo pnpm con dos artefactos:

- API: `pnpm --filter @workspace/api-server run dev`
- Web: `pnpm --filter @workspace/laboratorio-mineria-datos run dev`
- Regenerar tipos y hooks desde OpenAPI: `pnpm --filter @workspace/api-spec run codegen`
- Verificar TypeScript: `pnpm --filter @workspace/api-server run typecheck` y `pnpm --filter @workspace/laboratorio-mineria-datos run typecheck`

La web lee `GET /api/lab/analysis`, reentrena con `POST /api/lab/train` y calcula predicciones con `POST /api/lab/predict`. El informe académico está disponible en `/informe`; desde allí se puede imprimir o guardar como PDF. En el panel principal también se puede consultar y descargar el archivo fuente Python del entrenador.

El informe incluye los diagramas CRISP-DM y del flujo de cada modelo, las gráficas de dispersión de los predictores y matrices de correlación de Pearson. Las dispersiones muestran una muestra reproducible de hasta 350 registros (semilla 42); las matrices se calculan sobre todas las filas de cada CSV. En energía, la correlación de los códigos originales de hora y día de semana no sustituye el análisis de su representación cíclica.

## Desplegar en Vercel

Importa este repositorio en Vercel y conserva **la raíz del repositorio** como directorio raíz del proyecto. `vercel.json` configura la instalación pnpm, la compilación de Vite, el directorio estático y las funciones Python; no sobrescribas esos comandos con rutas del subdirectorio del artefacto.

Vercel publica estas funciones en las mismas rutas que usa la aplicación:

- `GET /api/lab/analysis`
- `POST /api/lab/train`
- `POST /api/lab/predict`

Las funciones de Vercel leen los CSV incluidos y el análisis empaquetado. El reentrenamiento calcula y devuelve los resultados en memoria; no depende de que los archivos escritos o el estado del proceso sobrevivan entre invocaciones serverless. Las dependencias Python están declaradas en `pyproject.toml`.

## Resultados de esta ejecución

| Caso | Filas | MSE | RMSE | R² |
|---|---:|---:|---:|---:|
| Dólar | 500 | 2,376.97 | 48.7542 COP | 0.9963 |
| Glucosa | 2,000 | 233.693 | 15.287 mg/dL | 0.6814 |
| Energía | 10,000 | 907.889 | 30.1312 kWh | 0.7819 |

Los resultados corresponden a los CSV incluidos y pueden cambiar si se sustituyen. Las asociaciones y coeficientes no implican causalidad ni garantizan predicciones fuera del rango observado.