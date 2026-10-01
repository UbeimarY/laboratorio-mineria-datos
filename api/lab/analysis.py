from http.server import BaseHTTPRequestHandler

from vercel_support.lab_api import public_analysis, read_analysis, send_json


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            send_json(self, 200, public_analysis(read_analysis()))
        except Exception:
            send_json(
                self,
                503,
                {"error": "No hay resultados publicados para el laboratorio."},
            )