import json
import os
import queue
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
from pathlib import Path

import pyttsx3
import sounddevice as sd
from vosk import KaldiRecognizer, Model


BASE_DIR = Path(__file__).resolve().parent
TASKS_FILE = BASE_DIR / "tarefas.json"
MODEL_DIR = Path(os.environ.get("VOSK_MODEL_PATH", BASE_DIR / "models" / "vosk-pt"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
ALLOW_REMOTE_OLLAMA = os.environ.get("JARVIS_ALLOW_REMOTE_OLLAMA", "").lower() in ("1", "true", "sim", "yes")
VOICE_NAME = os.environ.get("JARVIS_VOICE", "").lower()
VOICE_RATE = int(os.environ.get("JARVIS_VOICE_RATE", "165"))
VOICE_VOLUME = float(os.environ.get("JARVIS_VOICE_VOLUME", "0.95"))
WAKE_WORDS = ("jarvis", "javis", "charles")
MAX_COMMAND_CHARS = 1200
MAX_TASK_CHARS = 180
MAX_TASKS = 50
MAX_REPLY_CHARS = 2200
LOCAL_OLLAMA_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}


SYSTEM_PROMPT = """
Voce e Jarvis, assistente pessoal em portugues do Brasil.
Chame o usuario de Chefe.
Seu tom e sofisticado, educado, extremamente competente, calmo e levemente espirituoso.
As prioridades atuais do Chefe sao: conseguir um estagio em TI, comprar uma moto e estruturar melhor a vida financeira.
Responda com clareza, precisao e utilidade. Avise quando nao tiver certeza e nao invente dados.
Quando o usuario procrastinar, cobre com firmeza elegante.
Quando o assunto envolver carreira, dinheiro ou decisao pratica, entregue o proximo passo em vez de explicar demais.
""".strip()


audio_queue = queue.Queue()


def main():
    print("Jarvis PC iniciando...")
    ensure_vosk_model()

    speaker = setup_speaker()
    speak(speaker, "Sistema pronto, Chefe. Pode falar comigo.")

    model = Model(str(MODEL_DIR))
    recognizer = KaldiRecognizer(model, 16000)

    with sd.RawInputStream(
        samplerate=16000,
        blocksize=8000,
        dtype="int16",
        channels=1,
        callback=audio_callback,
    ):
        print("Ouvindo. Diga 'Jarvis' antes do pedido, ou pressione Ctrl+C para sair.")
        while True:
            data = audio_queue.get()
            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                text = normalize(result.get("text", ""))
                if not text:
                    continue

                print(f"Voce: {text}")
                command = strip_wake_word(text)
                if not command:
                    print("Aguardando comando depois do nome Jarvis.")
                    continue

                reply = handle_text(command)
                print(f"Jarvis: {reply}")
                speak(speaker, reply)


def ensure_vosk_model():
    if MODEL_DIR.exists():
        return

    message = f"""
Modelo do Vosk nao encontrado em:
{MODEL_DIR}

Baixe um modelo em portugues no site oficial do Vosk e extraia a pasta para esse caminho.
Exemplo de pasta final:
{BASE_DIR}\\models\\vosk-pt

Tambem da para definir outro caminho com:
$env:VOSK_MODEL_PATH = "C:\\caminho\\para\\modelo"
""".strip()
    print(message)
    sys.exit(1)


def setup_speaker():
    speaker = pyttsx3.init()
    speaker.setProperty("rate", VOICE_RATE)
    speaker.setProperty("volume", VOICE_VOLUME)

    voices = speaker.getProperty("voices")
    preferred_voice = pick_voice(voices)
    if preferred_voice:
        speaker.setProperty("voice", preferred_voice.id)

    return speaker


def pick_voice(voices):
    if VOICE_NAME:
        configured = next(
            (voice for voice in voices if VOICE_NAME in voice.name.lower() or VOICE_NAME in voice.id.lower()),
            None,
        )
        if configured:
            return configured

    scored = sorted(voices, key=voice_score, reverse=True)
    return scored[0] if scored and voice_score(scored[0]) > 0 else None


def voice_score(voice):
    name = voice.name.lower()
    voice_id = voice.id.lower()
    text = f"{name} {voice_id}"
    score = 0

    if "pt-br" in text or "brazil" in text or "brasil" in text:
        score += 12
    if "portugu" in text or "pt_" in text or "pt-" in text:
        score += 8
    if "natural" in text or "neural" in text or "online" in text:
        score += 5
    if "antonio" in text or "daniel" in text:
        score += 3
    if "microsoft" in text:
        score += 2

    return score


def audio_callback(indata, frames, time_info, status):
    if status:
        print(status, file=sys.stderr)
    audio_queue.put(bytes(indata))


def normalize(text):
    return " ".join(text.lower().strip().split())


def strip_wake_word(text):
    if text.startswith(WAKE_WORDS):
        parts = text.split(" ", 1)
        return parts[1].strip() if len(parts) > 1 else ""

    return text


def handle_text(text):
    text = sanitize_text(text, MAX_COMMAND_CHARS)

    if text in ("sair", "encerrar", "desligar"):
        raise KeyboardInterrupt

    if "que horas" in text or text == "horas" or "hora atual" in text:
        return f"Chefe, agora sao {datetime.now().strftime('%H:%M')}."

    if "abrir youtube" in text or "abre youtube" in text:
        webbrowser.open("https://www.youtube.com")
        return "Abrindo YouTube."

    if text.startswith("pesquisar ") or text.startswith("pesquise "):
        query = text.replace("pesquisar", "", 1).replace("pesquise", "", 1).strip()
        if not query:
            return "Chefe, me diga o que voce quer pesquisar."
        webbrowser.open(build_google_search_url(query))
        return f"Chefe, pesquisando por {query}."

    if "criar uma tarefa" in text or "crie uma tarefa" in text or text.startswith("tarefa "):
        task = cleanup_task(text)
        save_task(task)
        return f"Chefe, tarefa registrada: {task}."

    if "listar tarefas" in text or "minhas tarefas" in text:
        tasks = load_tasks()
        if not tasks:
            return "Chefe, voce ainda nao tem tarefas registradas."
        return "Chefe, suas tarefas principais: " + "; ".join(tasks[:5])

    if "limpar tarefas" in text:
        TASKS_FILE.write_text("[]", encoding="utf-8")
        return "Chefe, lista de tarefas limpa."

    return ask_ollama(text)


def cleanup_task(text):
    removals = (
        "jarvis",
        "criar uma tarefa para",
        "crie uma tarefa para",
        "criar uma tarefa",
        "crie uma tarefa",
        "tarefa",
    )
    task = text
    for item in removals:
        task = task.replace(item, "")
    task = task.strip(" .:-")
    task = sanitize_text(task, MAX_TASK_CHARS)
    return task.capitalize() if task else "Revisar proxima acao"


def load_tasks():
    if not TASKS_FILE.exists():
        return []
    try:
        return json.loads(TASKS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def save_task(task):
    tasks = load_tasks()
    tasks.insert(0, task)
    tasks = tasks[:MAX_TASKS]
    tmp_file = TASKS_FILE.with_suffix(".tmp")
    tmp_file.write_text(json.dumps(tasks, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp_file, TASKS_FILE)


def ask_ollama(text):
    if not is_safe_ollama_url(OLLAMA_URL):
        return "Chefe, bloqueei o endpoint do Ollama porque ele nao parece local. Se voce quiser usar um servidor remoto, defina JARVIS_ALLOW_REMOTE_OLLAMA=1 conscientemente."

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{SYSTEM_PROMPT}\n\nUsuario: {sanitize_text(text, MAX_COMMAND_CHARS)}\nJarvis:",
        "stream": False,
        "options": {
            "temperature": 0.4,
            "num_predict": 160,
        },
    }

    try:
        request = urllib.request.Request(
            OLLAMA_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
        return sanitize_text(data.get("response", ""), MAX_REPLY_CHARS) or "Chefe, recebi, mas o modelo local nao retornou texto."
    except urllib.error.URLError:
        return "Chefe, nao consegui conectar ao Ollama. Abra o Ollama e confirme se o modelo local esta instalado."


def speak(speaker, text):
    speaker.say(sanitize_text(text, MAX_REPLY_CHARS))
    speaker.runAndWait()


def sanitize_text(text, max_chars):
    return " ".join(str(text or "").split())[:max_chars].strip()


def build_google_search_url(query):
    params = urllib.parse.urlencode({"q": sanitize_text(query, MAX_COMMAND_CHARS)})
    return f"https://www.google.com/search?{params}"


def is_safe_ollama_url(url):
    try:
        parsed = urllib.parse.urlparse(url)
    except ValueError:
        return False

    if parsed.scheme not in ("http", "https"):
        return False

    if ALLOW_REMOTE_OLLAMA:
        return parsed.scheme == "https" or parsed.hostname in LOCAL_OLLAMA_HOSTS

    return parsed.scheme == "http" and parsed.hostname in LOCAL_OLLAMA_HOSTS


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nJarvis encerrado.")
