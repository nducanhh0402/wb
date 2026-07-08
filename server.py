import json
import os
import hashlib
import uuid
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 3000
DATA_FILE = 'data.json'
USERS_FILE = 'users.json'

def load_json(filepath, default_val):
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return default_val
    return default_val

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

class TutorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='.', **kwargs)

    def _send_json_response(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _get_user_from_token(self):
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ')[1]
        
        users = load_json(USERS_FILE, {})
        for username, user_info in users.items():
            if user_info.get('token') == token:
                return username
        return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/entries':
            username = self._get_user_from_token()
            if not username:
                self._send_json_response(401, {"error": "Unauthorized"})
                return

            all_entries = load_json(DATA_FILE, [])
            user_entries = [e for e in all_entries if e.get("username") == username]
            self._send_json_response(200, user_entries)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b''
        
        try:
            body = json.loads(post_data.decode('utf-8')) if post_data else {}
        except json.JSONDecodeError:
            self._send_json_response(400, {"error": "Invalid JSON"})
            return

        if parsed.path == '/api/register':
            username = body.get('username')
            password = body.get('password')
            
            if not username or not password:
                self._send_json_response(400, {"error": "Username and password required"})
                return

            users = load_json(USERS_FILE, {})
            if username in users:
                self._send_json_response(400, {"error": "Username already exists"})
                return
            
            users[username] = {
                "password": hash_password(password),
                "token": None
            }
            save_json(USERS_FILE, users)
            self._send_json_response(201, {"message": "Registered successfully"})
            
        elif parsed.path == '/api/login':
            username = body.get('username')
            password = body.get('password')
            
            users = load_json(USERS_FILE, {})
            user = users.get(username)
            
            if user and user['password'] == hash_password(password):
                token = str(uuid.uuid4())
                user['token'] = token
                save_json(USERS_FILE, users)
                self._send_json_response(200, {"token": token, "username": username})
            else:
                self._send_json_response(401, {"error": "Invalid credentials"})

        elif parsed.path == '/api/entries':
            username = self._get_user_from_token()
            if not username:
                self._send_json_response(401, {"error": "Unauthorized"})
                return

            new_entry = body
            new_entry["id"] = str(uuid.uuid4())
            new_entry["username"] = username

            entries = load_json(DATA_FILE, [])
            entries.append(new_entry)
            save_json(DATA_FILE, entries)
            
            self._send_json_response(201, new_entry)
        else:
            self.send_error(404, "Not Found")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/entries':
            username = self._get_user_from_token()
            if not username:
                self._send_json_response(401, {"error": "Unauthorized"})
                return
            
            qs = urllib.parse.parse_qs(parsed.query)
            entry_id = qs.get('id', [None])[0]
            if not entry_id:
                self._send_json_response(400, {"error": "Missing ID"})
                return

            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else b''
            try:
                body = json.loads(post_data.decode('utf-8')) if post_data else {}
            except json.JSONDecodeError:
                self._send_json_response(400, {"error": "Invalid JSON"})
                return

            entries = load_json(DATA_FILE, [])
            updated = False
            for e in entries:
                if e.get("id") == entry_id and e.get("username") == username:
                    e["studentName"] = body.get("studentName", e.get("studentName"))
                    e["date"] = body.get("date", e.get("date"))
                    e["fee"] = body.get("fee", e.get("fee"))
                    e["notes"] = body.get("notes", e.get("notes"))
                    updated = True
                    break
            
            if updated:
                save_json(DATA_FILE, entries)
                self._send_json_response(200, {"message": "Updated successfully"})
            else:
                self._send_json_response(404, {"error": "Entry not found"})
        else:
            self.send_error(404, "Not Found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/entries':
            username = self._get_user_from_token()
            if not username:
                self._send_json_response(401, {"error": "Unauthorized"})
                return
            
            qs = urllib.parse.parse_qs(parsed.query)
            entry_id = qs.get('id', [None])[0]
            if not entry_id:
                self._send_json_response(400, {"error": "Missing ID"})
                return

            entries = load_json(DATA_FILE, [])
            new_entries = [e for e in entries if not (e.get("id") == entry_id and e.get("username") == username)]
            
            if len(entries) != len(new_entries):
                save_json(DATA_FILE, new_entries)
                self._send_json_response(200, {"message": "Deleted successfully"})
            else:
                self._send_json_response(404, {"error": "Entry not found"})
        else:
            self.send_error(404, "Not Found")


if __name__ == '__main__':
    if not os.path.exists('public'):
        os.makedirs('public')
    with HTTPServer(('', PORT), TutorHandler) as httpd:
        print(f"🚀 Server đang chạy tại http://localhost:{PORT}")
        httpd.serve_forever()
