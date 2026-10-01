from http.server import BaseHTTPRequestHandler

from vercel_support.lab_api import read_json_body, send_json, train_in_memory


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            body = read_json_body(self)
        except ValueError as error:
            send_json(self, 400, {"error": str(error)})
            return

        if not isinstance(body, dict) or body.get("source") != "included_csv":
            send_json(
                self,
                400,
                {"error": "La fuente de entrenamiento debe ser included_csv."},
            )
            return

        try:
            send_json(self, 200, train_in_memory())
        except Exception:
            send_json(
                self,
                500,
                {"error": "No fue posible reentrenar los modelos con los CSV incluidos."},
            )