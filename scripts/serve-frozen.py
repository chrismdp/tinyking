#!/usr/bin/env python3
"""Serve a compiled Tiny King artifact on localhost, without a watcher."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class FrozenHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        # Only real application routes fall back. Missing JS/images stay 404.
        if urlsplit(self.path).path in ('/', '/debug/worldgen'):
            self.path = '/index.html'
        return super().send_head()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--port', type=int, default=8123)
    args = parser.parse_args()
    directory = args.directory.resolve(strict=True)
    if not (directory / 'index.html').is_file():
        parser.error('directory must contain the compiled index.html')
    with ThreadingHTTPServer(('127.0.0.1', args.port),
                             lambda *a, **kw: FrozenHandler(*a, directory=str(directory), **kw)) as server:
        server.serve_forever()
