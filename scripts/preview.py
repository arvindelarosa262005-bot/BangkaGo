"""Local static SPA preview only; never use as production hosting."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8082)
parser.add_argument("--root", default="apps/mobile/dist")
options = parser.parse_args()
root = Path(options.root).resolve()
if not (root / "index.html").is_file():
    raise SystemExit("Export the application before starting its preview.")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)

    def do_GET(self):
        if "text/html" in self.headers.get("Accept", ""):
            requested = root / urlsplit(self.path).path.lstrip("/")
            if not requested.is_file():
                self.path = "/index.html"
        super().do_GET()


print(f"BangkaGo preview: http://127.0.0.1:{options.port}", flush=True)
ThreadingHTTPServer(("127.0.0.1", options.port), Handler).serve_forever()
