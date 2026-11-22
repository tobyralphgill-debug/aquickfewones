"""aQuickFewOnes.com — the arena page plus a two-player room list."""

import json
import os
import random
import socket
import string
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8767
rooms = {}
lock = threading.Lock()


def lan_ip():
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0") or 0)
    raw = handler.rfile.read(length) if length else b"{}"
    try:
        return json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return {}


def send_json(handler, payload, status=200):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def new_id():
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


def new_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(4))


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if str(args[0]).startswith("GET /api") or str(args[0]).startswith("POST /api"):
            return
        super().log_message(fmt, *args)

    def do_GET(self):
        if self.path.startswith("/api/"):
            send_json(self, {"error": "Use POST"}, 404)
            return
        super().do_GET()

    def do_POST(self):
        data = read_json(self)
        if self.path == "/api/host":
            with lock:
                code = new_code()
                while code in rooms:
                    code = new_code()
                player_id = new_id()
                rooms[code] = {"players": {player_id: {"state": None, "inbox": []}}}
            link = f"http://{lan_ip()}:{PORT}/?room={code}"
            send_json(self, {"code": code, "id": player_id, "link": link})
            return
        if self.path == "/api/join":
            code = str(data.get("code", "")).strip().upper()
            with lock:
                room = rooms.get(code)
                if room is None:
                    send_json(self, {"error": "No room with that code."}, 404)
                    return
                if len(room["players"]) >= 2:
                    send_json(self, {"error": "That room is full."}, 409)
                    return
                player_id = new_id()
                room["players"][player_id] = {"state": None, "inbox": []}
            send_json(self, {"code": code, "id": player_id})
            return
        if self.path == "/api/sync":
            code = str(data.get("code", "")).strip().upper()
            player_id = str(data.get("id", ""))
            with lock:
                room = rooms.get(code)
                if room is None or player_id not in room["players"]:
                    send_json(self, {"error": "Room closed."}, 404)
                    return
                me = room["players"][player_id]
                me["state"] = data.get("state")
                for event in data.get("events") or []:
                    for other_id, other in room["players"].items():
                        if other_id != player_id:
                            other["inbox"].append(event)
                opponent = None
                for other_id, other in room["players"].items():
                    if other_id != player_id and other["state"] is not None:
                        opponent = other["state"]
                events = me["inbox"]
                me["inbox"] = []
                waiting = len(room["players"]) < 2
            send_json(self, {"opponent": opponent, "events": events, "waiting": waiting})
            return
        send_json(self, {"error": "Unknown"}, 404)


class ReuseServer(ThreadingHTTPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    server = ReuseServer(("0.0.0.0", PORT), Handler)
    print(f"aQuickFewOnes.com on http://127.0.0.1:{PORT}/", flush=True)
    server.serve_forever()
