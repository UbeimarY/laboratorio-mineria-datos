"""Entrypoint cómodo para regenerar el análisis y sus modelos exportados."""

from pathlib import Path
import runpy


if __name__ == "__main__":
    script = (
        Path(__file__).parent
        / "artifacts"
        / "laboratorio-mineria-datos"
        / "analysis"
        / "train_models.py"
    )
    runpy.run_path(str(script), run_name="__main__")