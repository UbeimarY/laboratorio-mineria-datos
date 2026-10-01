"""Entrena los tres modelos del laboratorio y exporta análisis reproducible."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
MODELS = ROOT / "analysis" / "models"
FIGURES = ROOT / "analysis" / "figures"
API_OUTPUT = ROOT.parents[1] / "artifacts" / "api-server" / "data" / "lab-analysis.json"
SEED = 42
TEST_SIZE = 0.20
CHART_SAMPLE_SIZE = 350

SPECIFICATIONS: list[dict[str, Any]] = [
    {
        "id": "dolar",
        "name": "Precio del dólar",
        "file": "dolar_data.csv",
        "target": "Precio_Dolar",
        "unit": "COP",
        "features": ["Dia", "Inflacion", "Tasa_interes"],
        "labels": {
            "Dia": "Día",
            "Inflacion": "Inflación",
            "Tasa_interes": "Tasa de interés",
        },
        "periodic": {},
    },
    {
        "id": "glucosa",
        "name": "Nivel de glucosa",
        "file": "glucosa_data.csv",
        "target": "Nivel_Glucosa",
        "unit": "mg/dL",
        "features": ["Edad", "IMC", "Actividad_Fisica"],
        "labels": {
            "Edad": "Edad",
            "IMC": "IMC",
            "Actividad_Fisica": "Actividad física semanal",
        },
        "periodic": {},
    },
    {
        "id": "energia",
        "name": "Consumo de energía",
        "file": "energia_data.csv",
        "target": "Consumo_Energia",
        "unit": "kWh",
        "features": ["Temperatura", "Hora", "Dia_Semana"],
        "labels": {
            "Temperatura": "Temperatura",
            "Hora": "Hora del día",
            "Dia_Semana": "Día de la semana",
        },
        "periodic": {"Hora": 24, "Dia_Semana": 7},
    },
]


def prepare_design_matrix(
    frame: pd.DataFrame, specification: dict[str, Any]
) -> tuple[pd.DataFrame, dict[str, list[str]]]:
    periodic = specification["periodic"]
    columns: dict[str, pd.Series] = {}
    groups: dict[str, list[str]] = {}
    for feature in specification["features"]:
        if feature not in periodic:
            columns[feature] = frame[feature].astype(float)
            groups[feature] = [feature]
            continue
        period = periodic[feature]
        radians = 2 * np.pi * (frame[feature].astype(float) - 1) / period
        sine_name = f"{feature}_sin"
        cosine_name = f"{feature}_cos"
        columns[sine_name] = np.sin(radians)
        columns[cosine_name] = np.cos(radians)
        groups[feature] = [sine_name, cosine_name]
    return pd.DataFrame(columns, index=frame.index), groups


def validate_dataset(frame: pd.DataFrame, specification: dict[str, Any]) -> None:
    required = [*specification["features"], specification["target"]]
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(
            f"{specification['file']}: faltan columnas requeridas: {', '.join(missing)}"
        )
    values = frame[required].apply(pd.to_numeric, errors="coerce")
    if values.isna().any().any() or not np.isfinite(values.to_numpy()).all():
        raise ValueError(
            f"{specification['file']}: hay valores vacíos, no numéricos o infinitos."
        )
    if frame.empty:
        raise ValueError(f"{specification['file']}: el archivo no contiene filas.")


def human_interpretation(
    feature: str,
    coefficient: float,
    standardized_impact: float,
    label: str,
    unit: str,
    cyclic_period: int | None,
) -> tuple[str, str]:
    if cyclic_period:
        amplitude = abs(coefficient)
        return (
            "cíclico",
            (
                f"{label} se modela como un ciclo de {cyclic_period} valores "
                f"(seno y coseno); su amplitud estimada es {amplitude:.4g} {unit}."
            ),
        )
    if coefficient > 0:
        direction = "positivo"
        effect = "aumenta"
    elif coefficient < 0:
        direction = "negativo"
        effect = "disminuye"
    else:
        direction = "neutro"
        effect = "no cambia"
    interpretation = (
        f"Al aumentar una unidad de {label}, la predicción {effect} "
        f"{abs(coefficient):.6g} {unit}, manteniendo constantes las demás "
        "variables del modelo."
    )
    return direction, interpretation


def plot_relationships(
    frame: pd.DataFrame, specification: dict[str, Any], destination: Path
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    features = specification["features"]
    target = specification["target"]
    fig, axes = plt.subplots(1, len(features), figsize=(5 * len(features), 4))
    if len(features) == 1:
        axes = [axes]
    color = {"dolar": "#2563eb", "glucosa": "#0f766e", "energia": "#c2410c"}[
        specification["id"]
    ]
    for axis, feature in zip(axes, features):
        axis.scatter(frame[feature], frame[target], alpha=0.35, s=14, color=color)
        axis.set_title(specification["labels"][feature])
        axis.set_xlabel(specification["labels"][feature])
        axis.set_ylabel(target)
        axis.grid(alpha=0.18)
    fig.suptitle(f"Relaciones con {target}")
    fig.tight_layout()
    fig.savefig(destination, dpi=150, bbox_inches="tight")
    plt.close(fig)


def fit_one(
    specification: dict[str, Any], *, persist_artifacts: bool = True
) -> dict[str, Any]:
    csv_path = RAW / specification["file"]
    if not csv_path.exists():
        raise FileNotFoundError(
            f"No se encontró el dataset requerido: {csv_path}. "
            "Guárdalo en data/raw/ con el nombre documentado."
        )
    frame = pd.read_csv(csv_path)
    validate_dataset(frame, specification)
    frame = frame.copy()
    frame[specification["features"] + [specification["target"]]] = frame[
        specification["features"] + [specification["target"]]
    ].apply(pd.to_numeric)

    design, groups = prepare_design_matrix(frame, specification)
    target = frame[specification["target"]].astype(float)
    x_train, x_test, y_train, y_test = train_test_split(
        design, target, test_size=TEST_SIZE, random_state=SEED
    )
    evaluation_model = LinearRegression().fit(x_train, y_train)
    predictions = evaluation_model.predict(x_test)
    mse = float(mean_squared_error(y_test, predictions))
    rmse = math.sqrt(mse)
    r2 = float(r2_score(y_test, predictions))

    # El conjunto de prueba se reserva para evaluar; el modelo de uso final se
    # vuelve a ajustar con todos los datos una vez terminada la evaluación.
    final_model = LinearRegression().fit(design, target)
    coefficients = dict(zip(design.columns, final_model.coef_.astype(float)))
    target_std = float(target.std(ddof=0)) or 1.0
    impacts: list[dict[str, Any]] = []
    raw_to_design_coefficients: dict[str, float] = {}
    for feature in specification["features"]:
        grouped_columns = groups[feature]
        if len(grouped_columns) == 1:
            coefficient = float(coefficients[grouped_columns[0]])
        else:
            coefficient = math.sqrt(
                sum(coefficients[column] ** 2 for column in grouped_columns)
            )
        standardized = math.sqrt(
            sum(
                (
                    coefficients[column]
                    * float(design[column].std(ddof=0))
                    / target_std
                )
                ** 2
                for column in grouped_columns
            )
        )
        raw_to_design_coefficients[feature] = coefficient
        direction, interpretation = human_interpretation(
            feature,
            coefficient,
            standardized,
            specification["labels"][feature],
            specification["unit"],
            specification["periodic"].get(feature),
        )
        impacts.append(
            {
                "feature": feature,
                "label": specification["labels"][feature],
                "coefficient": coefficient,
                "standardized_impact": standardized,
                "importance_pct": 0.0,
                "direction": direction,
                "interpretation": interpretation,
            }
        )
    total_impact = sum(item["standardized_impact"] for item in impacts) or 1.0
    for item in impacts:
        item["importance_pct"] = round(
            100 * item["standardized_impact"] / total_impact, 4
        )
    impacts.sort(key=lambda item: item["standardized_impact"], reverse=True)

    if persist_artifacts:
        plot_relationships(
            frame, specification, FIGURES / f"{specification['id']}.png"
        )
    chart_frame = frame
    if len(frame) > CHART_SAMPLE_SIZE:
        chart_frame = frame.sample(CHART_SAMPLE_SIZE, random_state=SEED)
    visualizations = []
    for feature in specification["features"]:
        points = [
            {"x": float(x), "y": float(y)}
            for x, y in zip(chart_frame[feature], chart_frame[specification["target"]])
        ]
        visualizations.append(
            {
                "feature": feature,
                "label": specification["labels"][feature],
                "points": points,
            }
        )
    top = impacts[0]
    conclusion = (
        f"La variable con mayor impacto estandarizado es {top['label']} "
        f"({top['importance_pct']:.1f}% del impacto relativo calculado). "
        f"En el conjunto de prueba, R² = {r2:.4f} y RMSE = {rmse:.4g} {specification['unit']}. "
        "La asociación del modelo describe estos datos y no demuestra causalidad."
    )
    model_id = specification["id"]
    if persist_artifacts:
        joblib.dump(
            {
                "model": final_model,
                "model_id": model_id,
                "target": specification["target"],
                "unit": specification["unit"],
                "raw_features": specification["features"],
                "design_columns": list(design.columns),
                "design_groups": groups,
                "periodic_encoding": specification["periodic"],
                "metrics_holdout": {"mse": mse, "rmse": rmse, "r2": r2},
                "training_rows": len(frame),
                "random_state": SEED,
            },
            MODELS / f"{model_id}.joblib",
            compress=3,
        )

    return {
        "id": model_id,
        "name": specification["name"],
        "target": specification["target"],
        "unit": specification["unit"],
        "row_count": int(len(frame)),
        "test_row_count": int(len(y_test)),
        "metrics": {"mse": mse, "rmse": rmse, "r2": r2},
        "intercept": float(final_model.intercept_),
        "prediction_coefficients": coefficients,
        "feature_impacts": impacts,
        "visualizations": visualizations,
        "data_preview": frame[
            specification["features"] + [specification["target"]]
        ]
        .head(8)
        .astype(float)
        .to_dict(orient="records"),
        "conclusion": conclusion,
    }


def write_report(models: list[dict[str, Any]]) -> None:
    lines = [
        "# Informe — Laboratorio 1: Minería de datos",
        "",
        "## Objetivo",
        "",
        "Aplicar CRISP-DM a tres conjuntos de datos, entrenar regresiones lineales múltiples, "
        "interpretar los coeficientes, evaluar el desempeño y desplegar una interfaz de predicción.",
        "",
        "## Metodología",
        "",
        "1. **Comprensión del negocio:** estimar dólar, glucosa y consumo de energía a partir de las variables indicadas.",
        "2. **Comprensión de los datos:** se revisaron columnas, tipos, valores vacíos y registros no numéricos.",
        "3. **Preparación:** se usaron los predictores y la variable objetivo especificados; para energía, hora y día de semana se codificaron de forma cíclica con seno y coseno.",
        f"4. **Modelado:** regresión lineal múltiple; partición aleatoria de {1 - TEST_SIZE:.0%} entrenamiento y {TEST_SIZE:.0%} prueba (random_state={SEED}).",
        "5. **Evaluación:** MSE, RMSE y R² calculados únicamente sobre el conjunto de prueba.",
        "6. **Despliegue:** los modelos finales se reajustan con todos los registros y se guardan en formato joblib para uso posterior.",
        "",
        "La importancia comparativa usa coeficientes estandarizados agrupados por variable original; no es una medida causal. "
        "Las variables cíclicas combinan sus componentes seno/coseno. El rendimiento depende de estos datos y no garantiza resultados fuera de su rango.",
        "",
    ]
    for model in models:
        lines.extend(
            [
                f"## {model['name']}",
                "",
                f"- Registros: **{model['row_count']:,}**; prueba: **{model['test_row_count']:,}**.",
                f"- **MSE:** {model['metrics']['mse']:.6g} {model['unit']}².",
                f"- **RMSE:** {model['metrics']['rmse']:.6g} {model['unit']}.",
                f"- **R²:** {model['metrics']['r2']:.6f}.",
                f"- Intercepto del modelo final: {model['intercept']:.8g}.",
                "",
                "### Coeficientes e impacto",
                "",
                "| Variable | Coeficiente / amplitud | Impacto estandarizado | Interpretación |",
                "|---|---:|---:|---|",
            ]
        )
        for impact in model["feature_impacts"]:
            lines.append(
                f"| {impact['label']} | {impact['coefficient']:.7g} | "
                f"{impact['importance_pct']:.1f}% | {impact['interpretation']} |"
            )
        lines.extend(
            [
                "",
                f"**Conclusión:** {model['conclusion']}",
                "",
                f"**Gráficas:** `figures/{model['id']}.png`.",
                "",
                f"**Modelo exportado:** `models/{model['id']}.joblib`.",
                "",
            ]
        )
    lines.extend(
        [
            "## Conclusiones generales",
            "",
            "Se entrenaron y evaluaron los tres modelos con una partición de prueba separada. "
            "Los coeficientes describen la asociación lineal estimada manteniendo fijas las demás variables; "
            "en energía, la codificación periódica evita tratar el final y el inicio del ciclo como extremos distantes. "
            "La interfaz permite comparar impactos, explorar relaciones y generar predicciones con los modelos exportados.",
            "",
        ]
    )
    (ROOT / "analysis" / "INFORME_CRISP_DM.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )


def build_analysis(*, persist_artifacts: bool = False) -> dict[str, Any]:
    """Train every dataset and optionally write local model/report artifacts."""
    if persist_artifacts:
        MODELS.mkdir(parents=True, exist_ok=True)
        FIGURES.mkdir(parents=True, exist_ok=True)
        API_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    results = [
        fit_one(specification, persist_artifacts=persist_artifacts)
        for specification in SPECIFICATIONS
    ]
    payload = {
        "models": results,
        "methodology": {
            "train_test_split": "80% entrenamiento / 20% prueba",
            "random_state": SEED,
            "periodic_encoding": (
                "Hora (24 valores) y Día de la semana (7 valores) usan seno/coseno "
                "para conservar su naturaleza cíclica."
            ),
            "importance_method": (
                "Magnitud de coeficientes estandarizados agrupada por variable original; "
                "es relativa y no causal."
            ),
        },
    }

    if persist_artifacts:
        API_OUTPUT.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        write_report(results)
    return payload


def main() -> None:
    payload = build_analysis(persist_artifacts=True)
    results = payload["models"]
    for model in results:
        print(
            f"{model['name']}: n={model['row_count']}, "
            f"MSE={model['metrics']['mse']:.6g}, "
            f"RMSE={model['metrics']['rmse']:.6g}, "
            f"R²={model['metrics']['r2']:.6f}"
        )
    print(f"Informe: {ROOT / 'analysis' / 'INFORME_CRISP_DM.md'}")
    print(f"API: {API_OUTPUT}")


if __name__ == "__main__":
    main()