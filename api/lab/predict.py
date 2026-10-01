from http.server import BaseHTTPRequestHandler

from vercel_support.lab_api import predict_value, read_json_body, send_json


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            body = read_json_body(self)
            result = predict_value(body)
            send_json(self, 200, result)
        except ValueError as error:
            send_json(self, 400, {"error": str(error)})
        except Exception:
            send_json(
                self,
                503,
                {"error": "No fue posible cargar el modelo para calcular la predicción."},
            )