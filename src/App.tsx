import {
  ArrowUp,
  Clock3,
  Command,
  ContactRound,
  Menu,
  Mic,
  MicOff,
  PanelRight,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import RightPanel from "./components/RightPanel";
import VoiceOrb from "./components/VoiceOrb";
import OperationsDrawer from "./components/OperationsDrawer";
import SideTabContent from "./components/SideTabContent";
import {
  askJarvis,
  buildActionIntent,
  buildCalendarDraft,
  buildWhatsAppDraft,
  greeting,
  loadJarvisState,
  saveJarvisState,
} from "./lib/jarvis";
import type { AssistantStatus, JarvisState, Message } from "./types";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const demoReplies = [
  "Analisei sua rotina. A melhor próxima ação é revisar duas vagas de estágio e reservar 30 minutos para evoluir o portfólio.",
  "Ambiente operacional: Gmail, Agenda, n8n, Ollama e voz estão conectados para execução assistida.",
  "Preparei uma visão executiva das próximas ações. Envios, agenda e mensagens continuam dependendo da sua confirmação.",
];

export default function App() {
  const [state, setState] = useState<JarvisState>(() => loadJarvisState());
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [active, setActive] = useState("Início");
  const [demo, setDemo] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [clock, setClock] = useState(new Date());
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveJarvisState(state), [state]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages, status]);

  const lastCommand = useMemo(
    () => [...state.messages].reverse().find((message) => message.role === "user")?.text || "",
    [state.messages],
  );

  const pendingCount = [
    state.pendingEmailDraft,
    state.pendingWhatsAppMessage,
    state.pendingCalendarEvent,
    state.pendingCalendarAction,
  ].filter(Boolean).length;

  function addMessage(message: Message) {
    setState((current) => ({
      ...current,
      messages: [...current.messages, { ...message, createdAt: new Date().toISOString() }].slice(-60),
    }));
  }

  async function speak(text: string) {
    if (state.voiceMode !== "on") return;
    setStatus("responding");
    try {
      if (state.voiceProvider === "external") {
        const response = await fetch("/api/tts-elevenlabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (response.ok) {
          const audio = new Audio(URL.createObjectURL(await response.blob()));
          audio.onended = () => setStatus("idle");
          await audio.play();
          return;
        }
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = Number(state.voiceRate || 0.8);
      utterance.pitch = Number(state.voicePitch || 0.68);
      utterance.onend = () => setStatus("idle");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      setStatus("idle");
    }
  }

  async function submit(raw = input) {
    const text = raw.trim();
    if (!text || status === "thinking") return;
    setInput("");
    addMessage({ role: "user", text });

    const normalized = text.toLowerCase();
    if (/confirmar (?:envio|email)/.test(normalized) && state.pendingEmailDraft) {
      await confirmAction("email");
      return;
    }
    if (/confirmar whatsapp/.test(normalized) && state.pendingWhatsAppMessage) {
      await confirmAction("whatsapp");
      return;
    }
    if (/(?:confirmar evento|pode agendar)/.test(normalized) && state.pendingCalendarEvent) {
      await confirmAction("calendar");
      return;
    }
    if (/cancelar (?:envio|email)/.test(normalized)) {
      setState((current) => ({ ...current, pendingEmailDraft: null }));
      addMessage({ role: "assistant", text: "Envio de email cancelado. Nada foi enviado." });
      return;
    }
    if (/cancelar whatsapp/.test(normalized)) {
      setState((current) => ({ ...current, pendingWhatsAppMessage: null }));
      addMessage({ role: "assistant", text: "Mensagem de WhatsApp cancelada. Nada foi enviado." });
      return;
    }
    if (/(?:cancelar evento|não agendar|nao agendar)/.test(normalized)) {
      setState((current) => ({ ...current, pendingCalendarEvent: null }));
      addMessage({ role: "assistant", text: "Evento cancelado. Nada foi criado na Agenda." });
      return;
    }

    if (/(agenda|reunião|reuniao|evento|compromisso)/.test(normalized) && /(agende|marque|crie)/.test(normalized)) {
      const event = buildCalendarDraft(text);
      if (event) {
        setState((current) => ({ ...current, pendingCalendarEvent: event }));
        const reply = `Evento preparado: ${event.title}. Revise em Pendências e confirme antes de criar.`;
        addMessage({ role: "assistant", text: reply });
        await speak(reply);
      } else {
        addMessage({ role: "assistant", text: "Entendi o evento, mas preciso da data e do horário." });
      }
      return;
    }

    if (/(whatsapp|zap)/.test(normalized) && /(mande|enviar|envie|prepare)/.test(normalized)) {
      const draft = buildWhatsAppDraft(text, state);
      if (draft) {
        setState((current) => ({ ...current, pendingWhatsAppMessage: draft }));
        const reply = `Mensagem preparada para ${draft.contactName}. Revise em Pendências e confirme antes do envio.`;
        addMessage({ role: "assistant", text: reply });
        await speak(reply);
        return;
      }
    }

    if (demo) {
      setStatus("thinking");
      await new Promise((resolve) => window.setTimeout(resolve, 950));
      const reply = demoReplies[Math.floor(Math.random() * demoReplies.length)];
      addMessage({ role: "assistant", text: reply });
      await speak(reply);
      return;
    }

    setStatus("thinking");
    try {
      const { data, reply } = await askJarvis(text, state, buildActionIntent(text, state));
      setState((current) => ({
        ...current,
        webhookHealthy: true,
        pendingEmailDraft: data.pendingEmailDraft || current.pendingEmailDraft,
        pendingCalendarEvent: data.pendingCalendarEvent || current.pendingCalendarEvent,
        tasks: Array.isArray(data.suggestedTasks)
          ? [...data.suggestedTasks, ...current.tasks].slice(0, 50)
          : current.tasks,
      }));
      addMessage({ role: "assistant", text: reply });
      await speak(reply);
    } catch (error) {
      const reply = `Não consegui falar com o n8n agora (${error instanceof Error ? error.message : "erro desconhecido"}).`;
      addMessage({ role: "assistant", text: reply });
      setStatus("idle");
    }
  }

  function toggleVoice() {
    if (status === "listening") {
      recognition.current?.stop();
      setStatus("idle");
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      addMessage({ role: "assistant", text: "Reconhecimento de voz indisponível. Use Chrome ou Edge." });
      return;
    }
    const instance = new Recognition();
    instance.lang = "pt-BR";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setInput(transcript);
      void submit(transcript);
    };
    instance.onend = () => setStatus((current) => current === "listening" ? "idle" : current);
    instance.onerror = () => setStatus("idle");
    recognition.current = instance;
    setStatus("listening");
    instance.start();
  }

  async function confirmAction(type: "email" | "whatsapp" | "calendar") {
    let intent = null;
    if (type === "email" && state.pendingEmailDraft) {
      intent = {
        service: "email",
        mode: "send",
        operation: "send_email_confirmed",
        confirmed: true,
        ...state.pendingEmailDraft,
      };
    }
    if (type === "whatsapp" && state.pendingWhatsAppMessage) {
      intent = {
        service: "whatsapp",
        mode: "send",
        operation: "send_whatsapp_confirmed",
        confirmed: true,
        to: state.pendingWhatsAppMessage.to,
        message: state.pendingWhatsAppMessage.message,
      };
    }
    if (type === "calendar" && state.pendingCalendarEvent) {
      intent = {
        service: "calendar",
        mode: "write",
        operation: "create_calendar_event_confirmed",
        confirmed: true,
        ...state.pendingCalendarEvent,
      };
    }
    if (!intent) return;
    setStatus("thinking");
    try {
      const { reply } = await askJarvis(`Confirmar ${type}`, state, intent);
      setState((current) => ({
        ...current,
        pendingEmailDraft: type === "email" ? null : current.pendingEmailDraft,
        pendingWhatsAppMessage: type === "whatsapp" ? null : current.pendingWhatsAppMessage,
        pendingCalendarEvent: type === "calendar" ? null : current.pendingCalendarEvent,
      }));
      addMessage({ role: "assistant", text: reply });
      setDrawer(false);
      await speak(reply);
    } catch (error) {
      addMessage({ role: "assistant", text: `A confirmação falhou: ${error instanceof Error ? error.message : "erro desconhecido"}.` });
      setStatus("idle");
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient-grid" />
      <div className="desktop-sidebar">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          active={active}
          setActive={setActive}
          demo={demo}
          setDemo={setDemo}
        />
      </div>

      <AnimatePresence>
        {mobileNav && (
          <motion.div className="mobile-nav-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="mobile-nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Fechar menu" />
            <Sidebar
              collapsed={false}
              setCollapsed={() => setMobileNav(false)}
              active={active}
              setActive={(item) => { setActive(item); setMobileNav(false); }}
              demo={demo}
              setDemo={setDemo}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="workspace glass-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu size={20} /></button>
            <span className="online-pulse" />
            <div><strong>Online</strong><small>Todos os sistemas operacionais</small></div>
          </div>
          <div className="topbar-actions">
            {demo && <span className="demo-pill"><Sparkles size={14} /> Modo demo</span>}
            <button className="pending-button" type="button" onClick={() => setDrawer(true)}>
              <ContactRound size={17} /><span>Central</span>{pendingCount > 0 && <b>{pendingCount}</b>}
            </button>
            <div className="clock-block">
              <Clock3 size={17} />
              <div>
                <strong>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong>
                <small>{clock.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</small>
              </div>
            </div>
          </div>
        </header>

        <div className="main-layout">
          {active === "Início" ? (
            <section className="assistant-stage">
              <div className="greeting">
                <small>ASSISTENTE PESSOAL</small>
                <h1>{greeting()}, <span>Ruan.</span></h1>
                <p>Pronto para ajudar.</p>
              </div>

              <VoiceOrb status={status} onClick={toggleVoice} />

              <div className="conversation-strip" ref={conversationRef}>
                <AnimatePresence initial={false}>
                  {state.messages.slice(-3).map((message, index) => (
                    <motion.article
                      key={`${message.createdAt || index}-${message.text.slice(0, 20)}`}
                      className={`chat-message ${message.role}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <span>{message.role === "assistant" ? "JARVIS" : "RUAN"}</span>
                      <p>{message.text}</p>
                    </motion.article>
                  ))}
                </AnimatePresence>
                {status === "thinking" && (
                  <div className="thinking-line"><i /><i /><i /> Analisando contexto</div>
                )}
              </div>

              <form
                className="command-input"
                onSubmit={(event) => { event.preventDefault(); void submit(); }}
              >
                <button
                  type="button"
                  className={status === "listening" ? "active" : ""}
                  onClick={toggleVoice}
                  aria-label="Microfone"
                >
                  {status === "listening" ? <MicOff size={21} /> : <Mic size={21} />}
                </button>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Fale comigo ou digite sua pergunta..."
                  maxLength={1200}
                />
                <button type="submit" aria-label="Enviar"><Send size={20} /></button>
              </form>

              <div className="status-selector" aria-label="Estado atual">
                {(["listening", "thinking", "responding"] as AssistantStatus[]).map((item) => (
                  <span key={item} className={status === item ? "active" : ""}>
                    {item === "listening" && <Mic size={15} />}
                    {item === "thinking" && <Command size={15} />}
                    {item === "responding" && <ArrowUp size={15} />}
                    {item === "listening" ? "Escutando" : item === "thinking" ? "Pensando" : "Respondendo"}
                  </span>
                ))}
              </div>
            </section>
          ) : (
            <SideTabContent
              active={active}
              state={state}
              setState={setState}
              setActive={setActive}
              setInput={setInput}
              openDrawer={() => setDrawer(true)}
              demo={demo}
              setDemo={setDemo}
              lastCommand={lastCommand}
            />
          )}

          <RightPanel state={state} lastCommand={lastCommand} />
        </div>
      </section>

      <OperationsDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        state={state}
        setState={setState}
        confirmEmail={() => void confirmAction("email")}
        confirmWhatsApp={() => void confirmAction("whatsapp")}
        confirmCalendar={() => void confirmAction("calendar")}
      />

      <button className="mobile-central" type="button" onClick={() => setDrawer(true)} aria-label="Abrir central">
        <PanelRight size={20} />{pendingCount > 0 && <span>{pendingCount}</span>}
      </button>
    </main>
  );
}
