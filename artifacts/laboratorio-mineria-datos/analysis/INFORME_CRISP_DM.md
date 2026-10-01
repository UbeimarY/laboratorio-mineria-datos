# Informe — Laboratorio 1: Minería de datos

## Objetivo

Aplicar CRISP-DM a tres conjuntos de datos, entrenar regresiones lineales múltiples, interpretar los coeficientes, evaluar el desempeño y desplegar una interfaz de predicción.

## Metodología

1. **Comprensión del negocio:** estimar dólar, glucosa y consumo de energía a partir de las variables indicadas.
2. **Comprensión de los datos:** se revisaron columnas, tipos, valores vacíos y registros no numéricos.
3. **Preparación:** se usaron los predictores y la variable objetivo especificados; para energía, hora y día de semana se codificaron de forma cíclica con seno y coseno.
4. **Modelado:** regresión lineal múltiple; partición aleatoria de 80% entrenamiento y 20% prueba (random_state=42).
5. **Evaluación:** MSE, RMSE y R² calculados únicamente sobre el conjunto de prueba.
6. **Despliegue:** los modelos finales se reajustan con todos los registros y se guardan en formato joblib para uso posterior.

La importancia comparativa usa coeficientes estandarizados agrupados por variable original; no es una medida causal. Las variables cíclicas combinan sus componentes seno/coseno. El rendimiento depende de estos datos y no garantiza resultados fuera de su rango.

## Precio del dólar

- Registros: **500**; prueba: **100**.
- **MSE:** 2376.97 COP².
- **RMSE:** 48.7542 COP.
- **R²:** 0.996313.
- Intercepto del modelo final: 3978.9846.

### Coeficientes e impacto

| Variable | Coeficiente / amplitud | Impacto estandarizado | Interpretación |
|---|---:|---:|---|
| Día | 4.99906 | 99.6% | Al aumentar una unidad de Día, la predicción aumenta 4.99906 COP, manteniendo constantes las demás variables del modelo. |
| Inflación | -338.0598 | 0.2% | Al aumentar una unidad de Inflación, la predicción disminuye 338.06 COP, manteniendo constantes las demás variables del modelo. |
| Tasa de interés | -2.532823 | 0.2% | Al aumentar una unidad de Tasa de interés, la predicción disminuye 2.53282 COP, manteniendo constantes las demás variables del modelo. |

**Conclusión:** La variable con mayor impacto estandarizado es Día (99.6% del impacto relativo calculado). En el conjunto de prueba, R² = 0.9963 y RMSE = 48.75 COP. La asociación del modelo describe estos datos y no demuestra causalidad.

**Gráficas:** `figures/dolar.png`.

**Modelo exportado:** `models/dolar.joblib`.

## Nivel de glucosa

- Registros: **2,000**; prueba: **400**.
- **MSE:** 233.693 mg/dL².
- **RMSE:** 15.287 mg/dL.
- **R²:** 0.681372.
- Intercepto del modelo final: 66.314991.

### Coeficientes e impacto

| Variable | Coeficiente / amplitud | Impacto estandarizado | Interpretación |
|---|---:|---:|---|
| Edad | 1.233681 | 69.8% | Al aumentar una unidad de Edad, la predicción aumenta 1.23368 mg/dL, manteniendo constantes las demás variables del modelo. |
| Actividad física semanal | -2.010386 | 18.9% | Al aumentar una unidad de Actividad física semanal, la predicción disminuye 2.01039 mg/dL, manteniendo constantes las demás variables del modelo. |
| IMC | 0.8832359 | 11.3% | Al aumentar una unidad de IMC, la predicción aumenta 0.883236 mg/dL, manteniendo constantes las demás variables del modelo. |

**Conclusión:** La variable con mayor impacto estandarizado es Edad (69.8% del impacto relativo calculado). En el conjunto de prueba, R² = 0.6814 y RMSE = 15.29 mg/dL. La asociación del modelo describe estos datos y no demuestra causalidad.

**Gráficas:** `figures/glucosa.png`.

**Modelo exportado:** `models/glucosa.joblib`.

## Consumo de energía

- Registros: **10,000**; prueba: **2,000**.
- **MSE:** 907.889 kWh².
- **RMSE:** 30.1312 kWh.
- **R²:** 0.781904.
- Intercepto del modelo final: 153.50639.

### Coeficientes e impacto

| Variable | Coeficiente / amplitud | Impacto estandarizado | Interpretación |
|---|---:|---:|---|
| Temperatura | 9.892068 | 60.6% | Al aumentar una unidad de Temperatura, la predicción aumenta 9.89207 kWh, manteniendo constantes las demás variables del modelo. |
| Hora del día | 38.34106 | 33.2% | Hora del día se modela como un ciclo de 24 valores (seno y coseno); su amplitud estimada es 38.34 kWh. |
| Día de la semana | 7.145839 | 6.2% | Día de la semana se modela como un ciclo de 7 valores (seno y coseno); su amplitud estimada es 7.146 kWh. |

**Conclusión:** La variable con mayor impacto estandarizado es Temperatura (60.6% del impacto relativo calculado). En el conjunto de prueba, R² = 0.7819 y RMSE = 30.13 kWh. La asociación del modelo describe estos datos y no demuestra causalidad.

**Gráficas:** `figures/energia.png`.

**Modelo exportado:** `models/energia.joblib`.

## Conclusiones generales

Se entrenaron y evaluaron los tres modelos con una partición de prueba separada. Los coeficientes describen la asociación lineal estimada manteniendo fijas las demás variables; en energía, la codificación periódica evita tratar el final y el inicio del ciclo como extremos distantes. La interfaz permite comparar impactos, explorar relaciones y generar predicciones con los modelos exportados.
