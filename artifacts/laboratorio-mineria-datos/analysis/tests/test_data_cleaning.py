"""Pruebas de limpieza y del entrenamiento compartido con la API de Vercel."""

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd

ANALYSIS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSIS))
from data_cleaning import clean_dataset, diagnose_outliers
from train_models import SPECIFICATIONS, build_analysis, fit_one


class CleaningTests(unittest.TestCase):
    def setUp(self):
        self.spec = SPECIFICATIONS[1]
        self.base = pd.DataFrame({
            "Edad": np.arange(20, 40),
            "IMC": np.arange(20, 40) / 2,
            "Actividad_Fisica": np.arange(20) % 5,
            "Nivel_Glucosa": np.arange(100, 120),
        })

    def test_clean_data_unchanged_and_original_preserved(self):
        original = self.base.copy(deep=True)
        clean, quality = clean_dataset(self.base, self.spec)
        pd.testing.assert_frame_equal(self.base, original)
        pd.testing.assert_frame_equal(clean, original.astype(float))
        self.assertEqual(quality["removed_rows"], 0)

    def test_exclusion_reasons_are_exclusive_and_no_imputation(self):
        extra = []
        for column, value in [
            ("Edad", None), ("IMC", "abc"), ("IMC", float("inf")),
            ("Nivel_Glucosa", -1), ("Edad", 20.5), ("Actividad_Fisica", -1),
            ("Nivel_Glucosa", None),
        ]:
            row = self.base.iloc[0].astype(object).copy()
            row[column] = value
            extra.append(row)
        raw = pd.concat([self.base, pd.DataFrame(extra), self.base.iloc[[0]]], ignore_index=True)
        original = raw.copy(deep=True)
        clean, q = clean_dataset(raw, self.spec)
        self.assertEqual(len(clean), 20)
        self.assertEqual(q["input_rows"], 28)
        self.assertEqual(q["missing_rows"], 2)
        self.assertEqual(q["non_numeric_rows"], 1)
        self.assertEqual(q["non_finite_rows"], 1)
        self.assertEqual(q["invalid_domain_rows"], 3)
        self.assertEqual(q["duplicate_rows"], 1)
        reasons = ("missing_rows", "non_numeric_rows", "non_finite_rows", "invalid_domain_rows", "duplicate_rows")
        self.assertEqual(sum(q[r] for r in reasons), q["removed_rows"])
        self.assertTrue(np.isfinite(clean.to_numpy()).all())
        pd.testing.assert_frame_equal(raw, original)

    def test_whitespace_and_decimal_comma_normalization(self):
        raw = self.base.astype(object)
        raw.loc[0, "IMC"] = " 10,5 "
        raw.loc[1, "IMC"] = " 11.5 "
        raw.columns = [" Edad ", "IMC", "Actividad_Fisica", "Nivel_Glucosa"]
        clean, q = clean_dataset(raw, self.spec)
        self.assertEqual(clean.loc[0, "IMC"], 10.5)
        self.assertEqual(clean.loc[1, "IMC"], 11.5)
        self.assertEqual(q["normalized_cells"], 2)
        self.assertEqual(q["removed_rows"], 0)

    def test_ambiguous_formats_are_not_guessed(self):
        raw = self.base.astype(object)
        raw.loc[0, "IMC"] = "1.234,56"
        raw.loc[1, "IMC"] = "1,234,567"
        _, q = clean_dataset(raw, self.spec)
        self.assertEqual(q["non_numeric_rows"], 2)

    def test_invalid_cyclic_codes_excluded(self):
        spec = SPECIFICATIONS[2]
        raw = pd.DataFrame({
            "Temperatura": np.arange(20),
            "Hora": np.arange(20) % 24 + 1,
            "Dia_Semana": np.arange(20) % 7 + 1,
            "Consumo_Energia": np.arange(20) + 10,
        })
        bad = raw.iloc[[0, 1, 2]].astype(object).copy()
        bad.loc[0, "Hora"] = 0
        bad.loc[1, "Dia_Semana"] = 8
        bad.loc[2, "Hora"] = 3.5
        clean, q = clean_dataset(pd.concat([raw, bad], ignore_index=True), spec)
        self.assertEqual(q["invalid_domain_rows"], 3)
        self.assertEqual(len(clean), 20)

    def test_missing_columns_empty_small_and_constant_target_fail(self):
        cases = [
            self.base.drop(columns=["IMC"]), self.base.iloc[:0],
            self.base.iloc[:5], self.base.assign(Nivel_Glucosa=100),
        ]
        for frame in cases:
            with self.subTest(rows=len(frame)), self.assertRaises(ValueError):
                clean_dataset(frame, self.spec)

    def test_outlier_limits_use_only_training_and_keep_test_outliers(self):
        frame = self.base.astype(float)
        frame.loc[19, "IMC"] = 1000000
        original = frame.copy(deep=True)
        q = {}
        diagnose_outliers(frame, frame.index[:16], frame.index[16:], self.spec, q)
        self.assertEqual(q["outlier_test_rows"], 1)
        self.assertEqual(q["outlier_train_rows"], 0)
        pd.testing.assert_frame_equal(frame, original)

    def test_training_handles_dirty_data_and_repeats_deterministically(self):
        dirty = pd.concat([self.base, self.base.iloc[[0]]], ignore_index=True)
        dirty.loc[len(dirty)] = [None, 12, 1, 110]
        with patch("train_models.pd.read_csv", return_value=dirty):
            first = fit_one(self.spec, persist_artifacts=False)
            second = fit_one(self.spec, persist_artifacts=False)
        self.assertEqual(first, second)
        self.assertEqual(first["row_count"], 20)
        self.assertEqual(first["data_quality"]["removed_rows"], 2)
        self.assertEqual(first["correlation_matrix"]["row_count"], 20)
        self.assertEqual(first["feature_ranges"]["Edad"], [20, 39])
        json.dumps(first, allow_nan=False)


class EndToEndPythonTests(unittest.TestCase):
    def test_in_memory_and_published_analysis_agree_and_predictions_work(self):
        root = ANALYSIS.parents[2]
        path = root / "vercel_support" / "lab_api.py"
        spec = importlib.util.spec_from_file_location("test_lab_api", path)
        api = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(api)
        live = api.train_in_memory()
        saved = api.public_analysis(api.read_analysis())
        self.assertEqual(live, saved)
        self.assertEqual(len(live["models"]), 3)
        for model in live["models"]:
            q = model["data_quality"]
            self.assertEqual(q["input_rows"] - q["removed_rows"], model["row_count"])
            self.assertEqual(q["output_rows"], model["correlation_matrix"]["row_count"])
            self.assertNotIn("prediction_coefficients", model)
            features = {
                key: (bounds[0] + bounds[1]) / 2
                for key, bounds in model["feature_ranges"].items()
            }
            if model["id"] == "energia":
                features["Hora"] = 12
                features["Dia_Semana"] = 4
            result = api.predict_value({"model_id": model["id"], "features": features})
            self.assertTrue(np.isfinite(result["prediction"]))
            key = next(iter(features))
            with self.assertRaises(ValueError):
                api.predict_value({"model_id": model["id"], "features": {**features, key: -999999}})
        with self.assertRaises(ValueError):
            api.predict_value({
                "model_id": "energia",
                "features": {"Temperatura": 25, "Hora": 12.5, "Dia_Semana": 4},
            })
        json.dumps(live, allow_nan=False)


if __name__ == "__main__":
    unittest.main()