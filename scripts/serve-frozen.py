#!/usr/bin/env python3
"""Serve a compiled Tiny King artifact on localhost, without a watcher."""
import argparse
from datetime import date, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parent.parent
SAVE_VERSION = re.search(r'export const SAVE_VERSION = (\d+);',
                         (ROOT / 'src/game/save_version.js').read_text()).group(1)


def world_week(week):
    if not re.fullmatch(r'\d{4}-W\d{2}', week):
        return None
    try:
        monday = date.fromisocalendar(int(week[:4]), int(week[6:]), 1)
    except ValueError:
        return None
    return {'id': week, 'monday': monday.isoformat()}


class FrozenHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, worlds, **kwargs):
        self.worlds = worlds / ('v' + SAVE_VERSION)
        super().__init__(*args, **kwargs)

    def world_head(self, path):
        if path == '/worlds' or path == '/worlds/current.json.gz':
            weeks = [world_week(p.name[:-8]) for p in self.worlds.glob('*.json.gz') if p.is_file()]
            weeks = sorted((week for week in weeks if week), key=lambda week: week['id'], reverse=True)
            if path == '/worlds':
                body = json.dumps(weeks).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Cache-Control', 'public, max-age=60')
                self.end_headers()
                return BytesIO(body)
            week = weeks[0] if weeks else None
        else:
            match = re.fullmatch(r'/worlds/(\d{4}-W\d{2})\.json\.gz', path)
            week = world_week(match[1]) if match else None
        filename = self.worlds / (week['id'] + '.json.gz') if week else None
        if not filename or not filename.is_file():
            self.send_error(404, 'World not found')
            return None
        stream = filename.open('rb')
        self.send_response(200)
        self.send_header('Content-Type', 'application/gzip')
        self.send_header('Content-Length', str(filename.stat().st_size))
        today = datetime.now(ZoneInfo('Europe/London')).date()
        past = date.fromisoformat(week['monday']).isocalendar()[:2] < today.isocalendar()[:2]
        lifetime = 31536000 if path != '/worlds/current.json.gz' and past else 60
        self.send_header('Cache-Control', 'public, max-age=' + str(lifetime))
        self.end_headers()
        return stream

    def send_head(self):
        path = urlsplit(self.path).path
        if path.startswith('/worlds'):
            return self.world_head(path)
        # Only real application routes fall back. Missing JS/images stay 404.
        if urlsplit(self.path).path in ('/', '/debug/worldgen'):
            self.path = '/index.html'
        return super().send_head()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--port', type=int, default=8123)
    parser.add_argument('--worlds', type=Path, default=ROOT / 'worlds')
    args = parser.parse_args()
    directory = args.directory.resolve(strict=True)
    if not (directory / 'index.html').is_file():
        parser.error('directory must contain the compiled index.html')
    with ThreadingHTTPServer(('127.0.0.1', args.port),
                             lambda *a, **kw: FrozenHandler(*a, directory=str(directory), worlds=args.worlds, **kw)) as server:
        server.serve_forever()
