import json
import mimetypes
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "dist" if (BASE_DIR / "dist" / "index.html").exists() else BASE_DIR
MEMORY_DIR = BASE_DIR / "memoria-obsidian"
MEMORY_FILE = MEMORY_DIR / "jarvis_memory.json"
TASKS_NOTE = MEMORY_DIR / "02 Tarefas.md"
HISTORY_NOTE = MEMORY_DIR / "03 Historico resumido.md"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787
DEFAULT_WEBHOOK_URL = "http://localhost:5678/webhook/jarvis"
DEFAULT_OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_OLLAMA_MODEL = "llama3.2:3b"
TAVILY_URL = "https://api.tavily.com/search"
ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
MAX_BODY_BYTES = 128 * 1024
MAX_TTS_CHARS = 1200
MAX_UPSTREAM_BYTES = 512 * 1024
MAX_AUDIO_BYTES = 6 * 1024 * 1024
LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "::1"}
SYSTEM_PROMPT = """
Voce e Jarvis, assistente pessoal em portugues do Brasil.
Chame o usuario de Chefe.
Responda com clareza, calma e utilidade.
Seu tom e sofisticado, educado, extremamente competente e levemente espirituoso.
Nao invente dados. Quando faltar informacao, pergunte uma coisa por vez.
Prioridades do usuario: conseguir estagio em TI, comprar uma moto e estruturar melhor a vida financeira.
""".strip()


def load_env(override=False):
    env_file = BASE_DIR / ".env"
    if not env_file.exists():
        return

    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if override or key not in os.environ:
            os.environ[key] = value.strip()


class JarvisHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_GET(self):
        if self.path in ("/", ""):
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        if not self.is_allowed_origin():
            self.send_json({"error": "forbidden_origin"}, status=403)
            return

        if self.path == "/api/tts-elevenlabs":
            self.handle_elevenlabs_tts()
            return

        if self.path == "/api/memory":
            self.handle_memory_sync()
            return

        if self.path == "/api/revise-email":
            self.handle_email_revision()
            return

        if self.path != "/api/jarvis":
            self.send_json({"error": "not_found"}, status=404)
            return

        body = self.read_body()
        if body is None:
            return

        payload = decode_json_body(body)
        if payload is None:
            self.send_json({"error": "invalid_json"}, status=400)
            return

        message = str(payload.get("message") or "").strip()
        profile = payload.get("profile") if isinstance(payload.get("profile"), dict) else {}
        action_intent = profile.get("actionIntent") if isinstance(profile.get("actionIntent"), dict) else {}
        has_integration_intent = bool(str(action_intent.get("service") or "").strip())
        if needs_search(message) and not has_integration_intent:
            self.send_json(self.ask_ollama_direct(body))
            return

        webhook_url = safe_service_url(os.environ.get("N8N_WEBHOOK_URL"), DEFAULT_WEBHOOK_URL)
        token = os.environ.get("JARVIS_WEBHOOK_TOKEN", "")

        headers = {"Content-Type": "application/json"}
        if token:
            headers["X-Jarvis-Token"] = token

        request = urllib.request.Request(
            webhook_url,
            data=body,
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = read_limited(response, MAX_UPSTREAM_BYTES)
                content_type = response.headers.get("content-type", "application/json")
                if not raw.strip():
                    self.send_json(self.ask_ollama_direct(body))
                    return
                self.send_response(response.status)
                self.send_header("Content-Type", content_type)
                self.end_headers()
                self.wfile.write(raw)
        except urllib.error.HTTPError as error:
            self.send_json({"error": "n8n_http_error", "status": error.code}, status=502)
        except urllib.error.URLError as error:
            direct = self.ask_ollama_direct(body)
            direct["n8nError"] = public_error(error.reason)
            self.send_json(direct)
        except ValueError:
            self.send_json({"error": "n8n_response_too_large"}, status=502)

    def read_body(self):
        content_type = self.headers.get("content-type", "")
        if self.path.startswith("/api/") and "application/json" not in content_type.lower():
            self.send_json({"error": "unsupported_content_type"}, status=415)
            return None

        try:
            size = int(self.headers.get("content-length", "0"))
        except ValueError:
            self.send_json({"error": "invalid_content_length"}, status=400)
            return None

        if size > MAX_BODY_BYTES:
            self.send_json({"error": "payload_too_large"}, status=413)
            return None

        return self.rfile.read(size)

    def is_allowed_origin(self):
        origin = self.headers.get("origin")
        if not origin:
            return True

        parsed = urllib.parse.urlparse(origin)
        origin_host = (parsed.hostname or "").lower()
        request_host = self.headers.get("host", "").split(":", 1)[0].strip("[]").lower()
        return origin_host in LOCAL_HOSTNAMES or origin_host == request_host

    def handle_elevenlabs_tts(self):
        load_env(override=True)

        body = self.read_body()
        if body is None:
            return

        api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
        voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "").strip()
        model_id = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2").strip()

        if not api_key or not voice_id:
            self.send_json(
                {
                    "error": "elevenlabs_not_configured",
                    "message": "Configure ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID no .env.",
                },
                status=400,
            )
            return

        payload = decode_json_body(body)
        if payload is None:
            self.send_json({"error": "invalid_json"}, status=400)
            return

        text = str(payload.get("text") or "").strip()[:MAX_TTS_CHARS]
        if not text:
            self.send_json({"error": "empty_text"}, status=400)
            return

        request_payload = {
            "text": text,
            "model_id": model_id,
            "language_code": "pt",
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.82,
                "style": 0.18,
                "use_speaker_boost": True,
                "speed": 0.92,
            },
        }

        url = ELEVENLABS_TTS_URL.format(voice_id=voice_id) + "?output_format=mp3_44100_128"
        request = urllib.request.Request(
            url,
            data=json.dumps(request_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "xi-api-key": api_key,
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                audio = read_limited(response, MAX_AUDIO_BYTES)
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except urllib.error.HTTPError as error:
            self.send_json({"error": "elevenlabs_http_error", "status": error.code}, status=502)
        except urllib.error.URLError as error:
            self.send_json({"error": "elevenlabs_unreachable", "detail": public_error(error.reason)}, status=502)
        except ValueError:
            self.send_json({"error": "elevenlabs_audio_too_large"}, status=502)

    def handle_memory_sync(self):
        body = self.read_body()
        if body is None:
            return

        payload = decode_json_body(body)
        if payload is None:
            self.send_json({"error": "invalid_json"}, status=400)
            return

        memory = normalize_memory_payload(payload)
        save_memory(memory)
        self.send_json({"ok": True, "tasks": len(memory["tasks"]), "messages": len(memory["recentMessages"])})

    def handle_email_revision(self):
        body = self.read_body()
        if body is None:
            return

        payload = decode_json_body(body)
        if payload is None:
            self.send_json({"error": "invalid_json"}, status=400)
            return

        instruction = clean_text(payload.get("instruction"), 1200)
        draft = payload.get("draft") if isinstance(payload.get("draft"), dict) else {}
        subject = clean_text(draft.get("subject"), 180)
        message = str(draft.get("message") or "").strip()[:5000]

        if not instruction or not message:
            self.send_json({"error": "missing_revision_data"}, status=400)
            return

        prompt = "\n".join([
            "Voce revisa um rascunho de email em portugues do Brasil.",
            "Aplique somente a alteracao pedida, preservando fatos e intencao.",
            "Se a alteracao mencionar somente assunto, nao altere nenhuma palavra do corpo.",
            "Se mencionar somente corpo, preserve o assunto.",
            "Nao invente nomes, datas, compromissos, anexos ou informacoes.",
            "Use ortografia e acentuacao corretas em UTF-8.",
            "Retorne apenas JSON valido com as chaves subject e message.",
            f"Assunto atual: {subject or 'Mensagem'}",
            f"Corpo atual:\n{message}",
            f"Alteracao solicitada: {instruction}",
        ])
        ollama_payload = {
            "model": os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
            "format": "json",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.25,
                "num_predict": 500,
            },
        }
        request = urllib.request.Request(
            safe_service_url(os.environ.get("OLLAMA_URL"), DEFAULT_OLLAMA_URL),
            data=json.dumps(ollama_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                data = json.loads(read_limited(response, MAX_UPSTREAM_BYTES).decode("utf-8"))
            revised = json.loads(str(data.get("response") or "{}"))
            revised_subject = clean_text(revised.get("subject"), 180) or subject or "Mensagem"
            revised_message = str(revised.get("message") or "").strip()[:5000]
            if not revised_message:
                raise ValueError("empty_revision")
            self.send_json({"subject": revised_subject, "message": revised_message})
        except (urllib.error.URLError, json.JSONDecodeError, ValueError) as error:
            self.send_json({"error": "revision_failed", "detail": public_error(error)}, status=502)

    def send_json(self, payload, status=200):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def ask_ollama_direct(self, body):
        payload = decode_json_body(body)
        if payload is None:
            return {"reply": "Chefe, recebi JSON invalido. Envie a mensagem novamente.", "model": "direct"}

        message = str(payload.get("message") or "").strip()[:1200]
        if not message:
            return {"reply": "Chefe, recebi uma chamada vazia. Envie uma mensagem para eu processar.", "model": "direct"}

        search_context = ""
        used_search = False
        requires_current_data = needs_search(message)
        if requires_current_data:
            search_context = search_tavily(message)
            used_search = bool(search_context)

        if search_context:
            today = datetime.now().strftime("%d/%m/%Y")
            prompt = (
                f"{SYSTEM_PROMPT}\n\n"
                f"Data local de hoje: {today}.\n"
                "Use exclusivamente o contexto de pesquisa abaixo para dados atuais. "
                "Nao mencione data limite de conhecimento. Nao invente valores. "
                "Se houver variacao entre fontes, explique brevemente. "
                "Inclua no final uma linha curta iniciada por 'Fontes:' com ate 3 URLs do contexto.\n\n"
                f"Pesquisa Tavily:\n{search_context}\n\n"
                f"Usuario: {message}\nJarvis:"
            )
        elif requires_current_data:
            return {
                "reply": (
                    "Chefe, nao consegui consultar fontes atuais agora. "
                    "Para evitar passar um valor antigo ou inventado, nao vou estimar. "
                    "Tente novamente em alguns instantes."
                ),
                "model": "search_unavailable",
                "via": "current_data_guard",
                "usedSearch": False,
            }
        else:
            prompt = f"{SYSTEM_PROMPT}\n\nUsuario: {message}\nJarvis:"

        ollama_payload = {
            "model": os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.35,
                "num_predict": 220,
            },
        }

        request = urllib.request.Request(
            safe_service_url(os.environ.get("OLLAMA_URL"), DEFAULT_OLLAMA_URL),
            data=json.dumps(ollama_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(read_limited(response, MAX_UPSTREAM_BYTES).decode("utf-8"))
            reply = str(data.get("response") or "").strip()
            if not reply:
                reply = "Chefe, o n8n respondeu vazio e o Ollama nao retornou texto."
            if used_search and "fontes:" not in reply.lower():
                source_urls = extract_source_urls(search_context)
                if source_urls:
                    reply = f"{reply.rstrip()}\n\nFontes: {' | '.join(source_urls)}"
            return {
                "reply": reply[:2200],
                "model": ollama_payload["model"],
                "via": "ollama_direct",
                "usedSearch": used_search,
            }
        except (urllib.error.URLError, json.JSONDecodeError, ValueError) as error:
            return {
                "reply": "Chefe, nao consegui acionar o Ollama local agora.",
                "error": public_error(error),
                "via": "direct_failed",
            }

    def log_message(self, format, *args):
        print(f"[jarvis] {self.address_string()} - {format % args}")


def main():
    load_env()
    mimetypes.add_type("text/javascript", ".js")
    host = os.environ.get("JARVIS_HOST", DEFAULT_HOST)
    port = int(os.environ.get("JARVIS_PORT", DEFAULT_PORT))
    server = ThreadingHTTPServer((host, port), JarvisHandler)
    print(f"Jarvis local em http://{host}:{port}")
    print(f"Proxy n8n em {safe_service_url(os.environ.get('N8N_WEBHOOK_URL'), DEFAULT_WEBHOOK_URL)}")
    server.serve_forever()


def decode_json_body(body):
    for encoding in ("utf-8", "utf-8-sig", "utf-16", "latin-1"):
        try:
            return json.loads(body.decode(encoding))
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
    return None


def read_limited(response, max_bytes):
    data = response.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValueError("upstream_response_too_large")
    return data


def public_error(error):
    return clean_text(error, 220) or "erro_indisponivel"


def safe_service_url(value, default):
    candidate = (value or default).strip()
    parsed = urllib.parse.urlparse(candidate)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return candidate
    return default


def needs_search(message):
    text = message.lower()
    triggers = (
        "hoje",
        "agora",
        "atual",
        "atuais",
        "noticia",
        "notícias",
        "ultimas",
        "últimas",
        "pesquise",
        "pesquisar",
        "procure",
        "internet",
        "web",
        "preco",
        "preço",
        "cotacao",
        "cotação",
        "clima",
        "tempo",
        "resultado",
        "placar",
        "recente",
    )
    return any(trigger in text for trigger in triggers)


def search_tavily(query):
    api_key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not api_key or api_key.startswith("cole_"):
        return ""

    payload = {
        "query": query,
        "topic": "general",
        "search_depth": "basic",
        "max_results": 5,
        "include_answer": "basic",
        "include_raw_content": False,
    }
    request = urllib.request.Request(
        TAVILY_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(read_limited(response, MAX_UPSTREAM_BYTES).decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError, ValueError):
        return ""

    lines = []
    if data.get("answer"):
        lines.append(f"Resposta resumida: {data['answer']}")

    for index, result in enumerate(data.get("results") or [], start=1):
        title = result.get("title") or "Resultado"
        url = result.get("url") or ""
        content = result.get("content") or ""
        lines.append(f"{index}. {title} - {url}\n{content}")

    return "\n\n".join(lines)[:5000]


def extract_source_urls(search_context):
    urls = []
    for token in str(search_context or "").split():
        candidate = token.strip("()[]{}<>,.;")
        if candidate.startswith(("https://", "http://")) and candidate not in urls:
            urls.append(candidate)
        if len(urls) >= 3:
            break
    return urls


def normalize_memory_payload(payload):
    tasks = normalize_string_list(payload.get("tasks"), max_items=80, max_chars=180)
    priorities = normalize_string_list(payload.get("priorities"), max_items=20, max_chars=180)
    contacts = []
    for item in payload.get("contacts") or []:
        if not isinstance(item, dict):
            continue
        name = clean_text(item.get("name"), 80)
        email = clean_text(item.get("email"), 160).lower()
        if name and "@" in email:
            contacts.append({"name": name, "email": email})
        if len(contacts) >= 100:
            break
    recent_messages = []

    for item in payload.get("recentMessages") or []:
        if not isinstance(item, dict):
            continue
        role = "user" if item.get("role") == "user" else "assistant"
        text = clean_text(item.get("text"), 900)
        if text:
            recent_messages.append({"role": role, "text": text})

    return {
        "updatedAt": current_timestamp(),
        "tasks": tasks,
        "priorities": priorities,
        "contacts": contacts,
        "recentMessages": recent_messages[-20:],
        "summary": clean_text(payload.get("summary"), 1600),
        "appendHistory": bool(payload.get("appendHistory")),
    }


def normalize_string_list(value, max_items, max_chars):
    result = []
    seen = set()
    for item in value or []:
        text = clean_text(item, max_chars)
        key = text.lower()
        if text and key not in seen:
            result.append(text)
            seen.add(key)
        if len(result) >= max_items:
            break
    return result


def clean_text(value, max_chars):
    return " ".join(str(value or "").replace("\x00", "").split())[:max_chars].strip()


def current_timestamp():
    from datetime import datetime

    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def save_memory(memory):
    MEMORY_DIR.mkdir(exist_ok=True)
    write_json_atomic(MEMORY_FILE, memory)
    write_tasks_note(memory)
    if memory.get("appendHistory"):
        append_history_note(memory)


def write_json_atomic(path, payload):
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp_path, path)


def write_tasks_note(memory):
    tasks = memory["tasks"]
    priorities = memory["priorities"]
    task_lines = "\n".join(f"- [ ] {task}" for task in tasks) or "- Nenhuma tarefa registrada."
    priority_lines = "\n".join(f"- {priority}" for priority in priorities) or "- Nenhuma prioridade registrada."

    content = "\n".join([
        "# Tarefas",
        "",
        f"Atualizado automaticamente: {memory['updatedAt']}",
        "",
        "## Prioridades",
        "",
        priority_lines,
        "",
        "## Proximas acoes",
        "",
        task_lines,
        "",
        "## Recorrentes",
        "",
        "- [ ] Revisar prioridades da semana.",
        "- [ ] Registrar aprendizados importantes.",
        "",
    ])
    TASKS_NOTE.write_text(content, encoding="utf-8")


def append_history_note(memory):
    if not memory["recentMessages"]:
        return

    existing = HISTORY_NOTE.read_text(encoding="utf-8") if HISTORY_NOTE.exists() else "# Historico Resumido\n"
    recent = "\n".join(
        f"- **{'Chefe' if item['role'] == 'user' else 'Jarvis'}:** {item['text']}"
        for item in memory["recentMessages"][-8:]
    )
    block = "\n".join([
        "",
        f"## Registro automatico - {memory['updatedAt']}",
        "",
        memory["summary"] or "Resumo automatico do estado recente do Jarvis.",
        "",
        "### Mensagens recentes",
        "",
        recent,
        "",
    ])

    marker = f"## Registro automatico - {memory['updatedAt']}"
    if marker not in existing:
        HISTORY_NOTE.write_text(existing.rstrip() + "\n" + block, encoding="utf-8")


if __name__ == "__main__":
    main()
