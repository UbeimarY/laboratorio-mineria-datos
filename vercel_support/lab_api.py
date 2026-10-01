"""Shared Vercel handlers for the laboratory's serverless Python routes."""

from __future__ import annotations

import importlib.util
import json
import math
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ANALYSIS_PATH = ROOT / "artifacts" / "api-server" / "data" / "lab-analysis.json"
TRAINER_PATH = (
    ROOT
    / "artifacts"
    / "laboratorio-mineria-datos"
    / "analysis"
    / "train_models.py"
)

EXPECTED_FEATURES: dict[str, list[str]] = {
    "dolar": ["Dia", "Inflacion", "Tasa_interes"],
    "glucosa": ["Edad", "IMC", "Actividad_Fisica"],
    "energia": ["Temperatura", "Hora", "Dia_Semana"],
}

TRAINING_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "dolar": {
        "Dia": (1, 500),
        "Inflacion": (0.0038, 0.0393),
        "Tasa_interes": (3.6516, 6.3162),
    },
    "glucosa": {
        "Edad": (20, 79),
        "IMC": (10.5867, 39.4302),
        "Actividad_Fisica": (0, 9),
    },
    "energia": {
        "Temperatura": (5.388, 44.6312),
        "Hora": (1, 24),
        "Dia_Semana": (1, 7),
    },
}


def send_json(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler: BaseHTTPRequestHandler, max_bytes: int = 16_384) -> Any:
    raw_length = handler.headers.get("Content-Length")
    try:
        length = int(raw_length or "0")
    except ValueError as error:
        raise ValueError("El tamaño del cuerpo de la solicitud no es válido.") from error
    if length <= 0 or length > max_bytes:
        raise ValueError("El cuerpo de la solicitud está vacío o es demasiado grande.")
    try:
        return json.loads(handler.rfile.read(length).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("El cuerpo debe contener JSON válido.") from error


def public_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    """Keep server-only prediction coefficients out of the browser response."""
    return {
        **analysis,
        "models": [
            {
                key: value
                for key, value in model.items()
                if key != "prediction_coefficients"
            }
            for model in analysis.get("models", [])
        ],
    }


def read_analysis() -> dict[str, Any]:
    with ANALYSIS_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def train_in_memory() -> dict[str, Any]:
    """Run the shared trainer without writing to Vercel's ephemeral filesystem."""
    spec = importlib.util.spec_from_file_location("lab_model_trainer", TRAINER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("No fue posible cargar el entrenador del laboratorio.")
    trainer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trainer)
    return public_analysis(trainer.build_analysis(persist_artifacts=False))


def predict_value(body: Any) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ValueError("Selecciona un modelo y proporciona sus variables.")
    model_id = body.get("model_id")
    features = body.get("features")
    expected = EXPECTED_FEATURES.get(model_id) if isinstance(model_id, str) else None
    if expected is None or not isinstance(features, dict):
        raise ValueError("Selecciona un modelo y proporciona sus variables.")

    supplied = sorted(features.keys())
    if supplied != sorted(expected):
        raise ValueError(f"Las variables requeridas son: {', '.join(expected)}.")

    for key, value in features.items():
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
        ):
            raise ValueError(f"{key} debe ser un número finito.")
        low, high = TRAINING_RANGES[model_id][key]
        if value < low or value > high:
            raise ValueError(
                f"{key} debe estar entre {low} y {high}, "
                "el rango disponible en el dataset."
            )

    analysis = read_analysis()
    model = next(
        (item for item in analysis["models"] if item["id"] == model_id), None
    )
    if model is None:
        raise ValueError("No se encontró el modelo solicitado.")

    coefficients = model["prediction_coefficients"]
    prediction = model["intercept"]
    if model_id == "energia":
        hour_angle = (2 * math.pi * (features["Hora"] - 1)) / 24
        weekday_angle = (2 * math.pi * (features["Dia_Semana"] - 1)) / 7
        prediction += features["Temperatura"] * coefficients["Temperatura"]
        prediction += math.sin(hour_angle) * coefficients["Hora_sin"]
        prediction += math.cos(hour_angle) * coefficients["Hora_cos"]
        prediction += math.sin(weekday_angle) * coefficients["Dia_Semana_sin"]
        prediction += math.cos(weekday_angle) * coefficients["Dia_Semana_cos"]
    else:
        for feature in expected:
            prediction += features[feature] * coefficients[feature]

    return {
        "model_id": model["id"],
        "prediction": prediction,
        "target": model["target"],
        "unit": model["unit"],
    }