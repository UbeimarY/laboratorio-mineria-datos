"""Limpieza determinista, no destructiva, para los CSV del laboratorio."""

from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

POLICY = (
    "Se recortan espacios y se interpreta una coma decimal simple (sin separadores "
    "de miles). Se excluyen, en este orden, filas con faltantes, texto no numérico, "
    "infinitos, valores fuera del dominio y duplicados exactos de predictores y "
    "objetivo. Cada fila excluida tiene un único motivo. No se imputan valores ni "
    "se modifica el CSV original."
)
OUTLIER_POLICY = (
    "Diagnóstico IQR: límites Q1 − 1,5×IQR y Q3 + 1,5×IQR calculados solo en "
    "entrenamiento, sin variables cíclicas. Las filas señaladas se conservan; "
    "un valor atípico no implica un error."
)


def clean_dataset(
    raw: pd.DataFrame, specification: dict[str, Any]
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """No aprende estadísticas: solo aplica reglas fijas antes de la partición."""
    frame = raw.copy()
    frame.columns = [str(column).strip() for column in frame.columns]
    if frame.columns.duplicated().any():
        raise ValueError(f"{specification['file']}: nombres de columnas duplicados.")
    required = [*specification["features"], specification["target"]]
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(
            f"{specification['file']}: faltan columnas requeridas: {', '.join(missing)}"
        )
    if frame.empty:
        raise ValueError(f"{specification['file']}: el archivo no contiene filas.")

    quality: dict[str, Any] = {
        "input_rows": int(len(frame)),
        "normalized_cells": 0,
        "outlier_train_rows": 0,
        "outlier_test_rows": 0,
        "policy": POLICY,
        "outlier_policy": OUTLIER_POLICY,
        "warnings": [],
    }

    def normalize(value: Any) -> Any:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        if re.fullmatch(r"[+-]?\d+,\d+(?:[eE][+-]?\d+)?", normalized):
            normalized = normalized.replace(",", ".")
        if normalized != value:
            quality["normalized_cells"] += 1
        return normalized if normalized else np.nan

    normalized = frame[required].apply(lambda column: column.map(normalize))
    numeric = normalized.apply(pd.to_numeric, errors="coerce").astype(float)
    remaining = pd.Series(True, index=frame.index)

    def exclude(reason: str, mask: pd.Series) -> None:
        nonlocal remaining
        selected = remaining & mask
        quality[reason] = int(selected.sum())
        remaining = remaining & ~selected

    exclude("missing_rows", normalized.isna().any(axis=1))
    exclude("non_numeric_rows", numeric.isna().any(axis=1))
    exclude(
        "non_finite_rows",
        pd.Series(~np.isfinite(numeric.to_numpy()).all(axis=1), index=frame.index),
    )
    invalid = pd.Series(False, index=frame.index)
    # Dominios físicos/lógicos, no límites estimados con todos los datos.
    target = specification["target"]
    invalid |= numeric[target] < 0
    if specification["id"] in ("dolar", "glucosa"):
        invalid |= numeric[target] == 0
    for feature in specification["features"]:
        if feature in ("Dia", "Edad"):
            invalid |= (numeric[feature] % 1 != 0) | (numeric[feature] < 0)
        if feature in ("Dia", "IMC"):
            invalid |= numeric[feature] <= 0
        if feature == "Actividad_Fisica":
            invalid |= numeric[feature] < 0
        if feature in specification["periodic"]:
            period = specification["periodic"][feature]
            invalid |= (
                (numeric[feature] < 1)
                | (numeric[feature] > period)
                | (numeric[feature] % 1 != 0)
            )
    exclude("invalid_domain_rows", invalid)
    quality["duplicate_rows"] = int(numeric.loc[remaining].duplicated().sum())
    cleaned = numeric.loc[remaining].drop_duplicates().reset_index(drop=True)
    quality["output_rows"] = int(len(cleaned))
    quality["removed_rows"] = quality["input_rows"] - quality["output_rows"]
    if len(cleaned) < 10:
        raise ValueError(
            f"{specification['file']}: tras la limpieza quedan {len(cleaned)} "
            "registros; se requieren al menos 10 para entrenar y evaluar."
        )
    if cleaned[target].nunique() < 2:
        raise ValueError(
            f"{specification['file']}: el objetivo no tiene variación tras la limpieza."
        )
    if quality["removed_rows"] / quality["input_rows"] > 0.2:
        quality["warnings"].append(
            "Se excluyó más del 20% de las filas; revisar la representatividad del conjunto."
        )
    constant = [f for f in specification["features"] if cleaned[f].nunique() < 2]
    if constant:
        quality["warnings"].append("Predictores constantes: " + ", ".join(constant) + ".")
    if quality["duplicate_rows"]:
        quality["warnings"].append(
            "Se quitaron repeticiones exactas de predictores y objetivo; "
            "si corresponden a observaciones independientes, revisar esta política."
        )
    return cleaned, quality


def diagnose_outliers(
    frame: pd.DataFrame, training_index: pd.Index, test_index: pd.Index,
    specification: dict[str, Any], quality: dict[str, Any],
) -> None:
    """Usa únicamente la partición de entrenamiento para definir los límites."""
    columns = [
        c for c in frame.columns if c not in specification["periodic"]
    ]
    train = frame.loc[training_index, columns]
    q1, q3 = train.quantile(0.25), train.quantile(0.75)
    iqr = q3 - q1
    flagged = (
        (frame[columns] < q1 - 1.5 * iqr)
        | (frame[columns] > q3 + 1.5 * iqr)
    ).any(axis=1)
    quality["outlier_train_rows"] = int(flagged.loc[training_index].sum())
    quality["outlier_test_rows"] = int(flagged.loc[test_index].sum())