# Laboratorio de Minería de Datos

Aplicación académica en español para estudiar tres modelos de regresión lineal —dólar, glucosa y consumo de energía— mediante CRISP-DM. Presenta métricas sobre datos de prueba, relaciones entre variables, interpretación de coeficientes y un formulario para generar predicciones.

## Ejecutar el análisis

Requisitos: Python 3.11 o posterior y las dependencias de `artifacts/laboratorio-mineria-datos/analysis/requirements.txt`.

```bash
python3 -m pip install -r artifacts/laboratorio-mineria-datos/analysis/requirements.txt
python3 main.py
```

Los tres CSV originales de práctica están en `artifacts/laboratorio-mineria-datos/data/raw/`. El análisis:

- valida columnas y aplica una limpieza reproducible sin modificar los CSV originales;
- evalúa con una partición aleatoria 80/20 y `random_state=42`;
- codifica hora y día de semana como variables periódicas para el caso de energía;
- reporta MSE, RMSE y R² en el conjunto de prueba;
- vuelve a ajustar cada modelo con todas las filas conservadas tras limpiar para exportarlo como `.joblib`;
- genera el informe CRISP-DM, las gráficas PNG y los resultados consumidos por la API.

Archivos generados:

- `artifacts/laboratorio-mineria-datos/analysis/INFORME_CRISP_DM.md`
- `artifacts/laboratorio-mineria-datos/analysis/models/{dolar,glucosa,energia}.joblib`
- `artifacts/laboratorio-mineria-datos/analysis/figures/{dolar,glucosa,energia}.png`
- `artifacts/api-server/data/lab-analysis.json`
- `artifacts/laboratorio-mineria-datos/data/processed/{dolar,glucosa,energia}_data.csv`
- `artifacts/laboratorio-mineria-datos/data/processed/quality-report.json`

Al cambiar un CSV, vuelve a ejecutar `python3 main.py` antes de probar la aplicación.

### Política de limpieza

Se recortan espacios en encabezados y celdas; se acepta una coma decimal simple sin separadores de miles. No se adivinan formatos ambiguos como `1.234,56`. Se excluyen filas con faltantes (incluido el objetivo), texto no numérico, infinitos, valores imposibles y duplicados exactos de predictores **y** objetivo. Los motivos se cuentan en ese orden, sin solapamiento, para que filas originales = filas conservadas + filas excluidas. No se imputan valores.

Los dominios son reglas fijas, no rangos aprendidos con datos de prueba: objetivos no negativos (dólar y glucosa estrictamente positivos), día positivo entero, edad no negativa entera, IMC positivo, actividad no negativa, hora entera 1–24 y día de semana entero 1–7. Las tasas económicas negativas y las temperaturas negativas no se excluyen automáticamente. Las repeticiones exactas se eliminan antes de dividir para evitar que una copia aparezca en entrenamiento y otra en prueba; si representan observaciones independientes, debe revisarse la política.

Los valores atípicos se diagnostican con IQR (1,5×IQR) calculado **solo en entrenamiento**, excluyendo los códigos cíclicos. Se cuentan por separado en entrenamiento y prueba y **se conservan**. No se elimina una observación por ser extrema ni se ajustan filtros para mejorar las métricas. El proceso falla explícitamente si faltan columnas, quedan menos de 10 filas o no hay variación suficiente del objetivo para evaluar.

El panel y el informe muestran la auditoría por modelo. Métricas, correlaciones, gráficas, vista previa, coeficientes y límites de predicción provienen de los datos conservados. La limpieza no convierte la evaluación aleatoria del dólar en una evaluación temporal y no garantiza mejores métricas.

Para comprobar reglas, reproducibilidad y la compatibilidad del entrenador con Vercel después de regenerar el análisis:

```bash
python3 -m unittest discover -s artifacts/laboratorio-mineria-datos/analysis/tests -v
```

## Ejecutar la aplicación

El espacio de trabajo es un monorepo pnpm con dos artefactos:

- API: `pnpm --filter @workspace/api-server run dev`
- Web: `pnpm --filter @workspace/laboratorio-mineria-datos run dev`
- Regenerar tipos y hooks desde OpenAPI: `pnpm --filter @workspace/api-spec run codegen`
- Verificar TypeScript: `pnpm --filter @workspace/api-server run typecheck` y `pnpm --filter @workspace/laboratorio-mineria-datos run typecheck`

La web lee `GET /api/lab/analysis`, limpia y reentrena con `POST /api/lab/train` y calcula predicciones con `POST /api/lab/predict`. El informe académico está disponible en `/informe`; desde allí se puede imprimir o guardar como PDF. En el panel principal también se pueden consultar y descargar los archivos fuente Python del entrenador y su módulo de limpieza; deben conservarse juntos.

El informe incluye los diagramas CRISP-DM y del flujo de cada modelo, las gráficas de dispersión de los predictores y matrices de correlación de Pearson. Las dispersiones muestran una muestra reproducible de hasta 350 filas conservadas (semilla 42); las matrices se calculan sobre todas las filas conservadas tras la limpieza de cada CSV. En energía, la correlación de los códigos originales de hora y día de semana no sustituye el análisis de su representación cíclica.

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