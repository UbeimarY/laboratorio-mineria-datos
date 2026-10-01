import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { Router, type IRouter } from "express";
import type {
  LabAnalysisResponse,
  LabModelAnalysis,
  LabPredictionRequest,
  LabPredictionResponse,
} from "@workspace/api-zod";
import { TrainLabModelsBody } from "@workspace/api-zod";

type LabModelWithCoefficients = LabModelAnalysis & {
  prediction_coefficients: Record<string, number>;
};

type LabAnalysisWithCoefficients = Omit<LabAnalysisResponse, "models"> & {
  models: LabModelWithCoefficients[];
};

const router: IRouter = Router();
const analysisPath = resolve(process.cwd(), "data", "lab-analysis.json");
const trainerPath = resolve(
  process.cwd(),
  "../laboratorio-mineria-datos/analysis/train_models.py",
);

function runTrainer(): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      process.env.PYTHON_BINARY ?? "python3",
      [trainerPath],
      { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 },
      (error) => (error ? reject(error) : resolvePromise()),
    );
  });
}

function readAnalysis(): LabAnalysisWithCoefficients {
  const content = readFileSync(analysisPath, "utf8");
  return JSON.parse(content) as LabAnalysisWithCoefficients;
}

const expectedFeatures: Record<string, string[]> = {
  dolar: ["Dia", "Inflacion", "Tasa_interes"],
  glucosa: ["Edad", "IMC", "Actividad_Fisica"],
  energia: ["Temperatura", "Hora", "Dia_Semana"],
};

const trainingRanges: Record<string, Record<string, [number, number]>> = {
  dolar: {
    Dia: [1, 500],
    Inflacion: [0.0038, 0.0393],
    Tasa_interes: [3.6516, 6.3162],
  },
  glucosa: {
    Edad: [20, 79],
    IMC: [10.5867, 39.4302],
    Actividad_Fisica: [0, 9],
  },
  energia: {
    Temperatura: [5.388, 44.6312],
    Hora: [1, 24],
    Dia_Semana: [1, 7],
  },
};

router.get("/lab/analysis", (_req, res) => {
  try {
    const analysis = readAnalysis();
    res.json({
      ...analysis,
      models: analysis.models.map(
        ({ prediction_coefficients: _coefficients, ...model }) => model,
      ),
    });
  } catch {
    res.status(503).json({
      error:
        "No hay resultados del laboratorio. Ejecuta python analysis/train_models.py para entrenar los modelos.",
    });
  }
});

router.post("/lab/train", async (req, res): Promise<void> => {
  const parsed = TrainLabModelsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    await runTrainer();
    const analysis = readAnalysis();
    res.json({
      ...analysis,
      models: analysis.models.map(
        ({ prediction_coefficients: _coefficients, ...model }) => model,
      ),
    });
  } catch (error) {
    req.log.error({ error }, "Live laboratory model training failed");
    res.status(500).json({
      error: "No fue posible reentrenar los modelos con los CSV incluidos.",
    });
  }
});

router.post("/lab/predict", (req, res) => {
  const body = req.body as Partial<LabPredictionRequest> | undefined;
  const modelId = body?.model_id;
  const features = body?.features;
  const expected = typeof modelId === "string" ? expectedFeatures[modelId] : null;

  if (
    typeof modelId !== "string" ||
    !expected ||
    !features ||
    typeof features !== "object" ||
    Array.isArray(features)
  ) {
    res.status(400).json({ error: "Selecciona un modelo y proporciona sus variables." });
    return;
  }
  const suppliedKeys = Object.keys(features).sort();
  if (JSON.stringify(suppliedKeys) !== JSON.stringify([...expected].sort())) {
    res.status(400).json({ error: `Las variables requeridas son: ${expected.join(", ")}.` });
    return;
  }
  for (const [key, value] of Object.entries(features)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      res.status(400).json({ error: `${key} debe ser un número finito.` });
      return;
    }
    const range = trainingRanges[modelId][key];
    if (range && (value < range[0] || value > range[1])) {
      res.status(400).json({
        error: `${key} debe estar entre ${range[0]} y ${range[1]}, el rango disponible en el dataset.`,
      });
      return;
    }
  }
  if (modelId === "energia") {
    const { Hora, Dia_Semana } = features;
    if (
      Hora < 1 ||
      Hora > 24 ||
      Dia_Semana < 1 ||
      Dia_Semana > 7
    ) {
      res.status(400).json({
        error: "La hora debe estar entre 1 y 24 y el día de semana entre 1 y 7.",
      });
      return;
    }
  }

  let model: LabModelWithCoefficients;
  try {
    const analysis = readAnalysis();
    const found = analysis.models.find((candidate) => candidate.id === modelId);
    if (!found) {
      res.status(400).json({ error: "No se encontró el modelo solicitado." });
      return;
    }
    model = found;
  } catch {
    res.status(503).json({
      error:
        "No hay modelos entrenados. Ejecuta python analysis/train_models.py antes de predecir.",
    });
    return;
  }

  const coefficients = model.prediction_coefficients;
  let prediction = model.intercept;
  if (modelId === "energia") {
    const hourAngle = (2 * Math.PI * (features.Hora - 1)) / 24;
    const weekdayAngle = (2 * Math.PI * (features.Dia_Semana - 1)) / 7;
    prediction += features.Temperatura * coefficients.Temperatura;
    prediction += Math.sin(hourAngle) * coefficients.Hora_sin;
    prediction += Math.cos(hourAngle) * coefficients.Hora_cos;
    prediction += Math.sin(weekdayAngle) * coefficients.Dia_Semana_sin;
    prediction += Math.cos(weekdayAngle) * coefficients.Dia_Semana_cos;
  } else {
    for (const feature of expected) {
      prediction += features[feature] * coefficients[feature];
    }
  }
  const response: LabPredictionResponse = {
    model_id: model.id,
    prediction,
    target: model.target,
    unit: model.unit,
  };
  res.json(response);
});

export default router;