import type {
  ActionIntent,
  Contact,
  JarvisState,
  PendingCalendarEvent,
  PendingWhatsApp,
} from "../types";

export const STORAGE_KEY = "jarvis-clean-state";

const initialState: JarvisState = {
  assistantName: "Jarvis",
  userName: "Chefe",
  voiceMode: "on",
  voiceProvider: "external",
  voiceName: "auto",
  voiceRate: "0.8",
  voicePitch: "0.68",
  webhookUrl: "",
  webhookToken: "",
  webhookHealthy: false,
  messages: [
    {
      role: "assistant",
      text: "Sistema pronto, Chefe. Estou conectado e aguardando seu comando.",
    },
  ],
  tasks: [],
  priorities: [],
  contacts: [],
  pendingEmailDraft: null,
  pendingWhatsAppMessage: null,
  pendingCalendarEvent: null,
  pendingCalendarAction: null,
  integrations: {
    email: "configured",
    calendar: "configured",
    whatsapp: "not_configured",
    instagram: "not_configured",
  },
};

export function loadJarvisState(): JarvisState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...initialState,
      ...saved,
      integrations: { ...initialState.integrations, ...saved.integrations },
      messages: Array.isArray(saved.messages) && saved.messages.length
        ? saved.messages
        : initialState.messages,
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      priorities: Array.isArray(saved.priorities) ? saved.priorities : [],
      contacts: Array.isArray(saved.contacts) ? saved.contacts : [],
    };
  } catch {
    return initialState;
  }
}

export function saveJarvisState(state: JarvisState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function resolveContact(text: string, contacts: Contact[]) {
  const normalized = normalize(text);
  return contacts.find((contact) => normalized.includes(normalize(contact.name)));
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function extractWhatsAppBody(text: string) {
  return text.match(/(?:dizendo|avisando|falando)(?: que)? (.+)$/i)?.[1]?.trim() || "";
}

function extractPhone(text: string) {
  const raw = text.match(/(?:\+?\d[\d\s().-]{8,}\d)/)?.[0] || "";
  let digits = raw.replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return digits.length >= 10 ? `+${digits}` : "";
}

export function buildActionIntent(text: string, state: JarvisState): ActionIntent {
  const value = normalize(text);
  const contact = resolveContact(text, state.contacts);

  if (/(whatsapp|zap)/.test(value)) {
    return {
      service: "whatsapp",
      mode: /(mand|envi|prepar)/.test(value) ? "send" : "read",
      operation: /(mand|envi|prepar)/.test(value)
        ? "prepare_whatsapp"
        : "read_whatsapp",
      to: extractPhone(text) || contact?.phone || "",
      message: extractWhatsAppBody(text),
      requiresConfirmation: true,
    };
  }

  if (/(agenda|calendario|compromisso|reuniao|evento)/.test(value)) {
    return {
      service: "calendar",
      mode: /(agend|cri|marqu|alter|exclu|apag|remov)/.test(value) ? "write" : "read",
      operation: "list_calendar_events",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 7 * 86400000).toISOString(),
      limit: 8,
      requiresConfirmation: false,
    };
  }

  if (/(email|e-mail|gmail|caixa de entrada|rascunho)/.test(value) || extractEmail(text)) {
    const sending = /(rascunho|prepar|escrev|redij|envi|mand)/.test(value);
    return {
      service: "email",
      mode: sending ? "send" : "read",
      operation: sending ? "draft_email" : "summarize_inbox",
      to: extractEmail(text) || contact?.email || "",
      query: text,
      limit: 8,
      requiresConfirmation: sending,
    };
  }

  return null;
}

export async function askJarvis(
  text: string,
  state: JarvisState,
  actionIntent: ActionIntent = buildActionIntent(text, state),
) {
  const response = await fetch("/api/jarvis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(state.webhookToken ? { "X-Jarvis-Token": state.webhookToken } : {}),
    },
    body: JSON.stringify({
      message: text,
      profile: {
        outputMode: state.voiceMode === "on" ? "spoken" : "text",
        actionIntent,
        integrations: state.integrations,
      },
      memory: {
        tasks: state.tasks.slice(0, 12),
        priorities: state.priorities.slice(0, 6),
        recentMessages: state.messages.slice(-8),
      },
    }),
  });

  if (!response.ok) throw new Error(`Webhook respondeu ${response.status}`);
  const data = await response.json();
  return {
    data,
    reply: String(data.reply || data.response || data.message || "Comando concluído."),
  };
}

export function buildWhatsAppDraft(text: string, state: JarvisState): PendingWhatsApp | null {
  const contact = resolveContact(text, state.contacts);
  const to = extractPhone(text) || contact?.phone || "";
  const message = extractWhatsAppBody(text);
  if (!to || !message) return null;
  return { to, contactName: contact?.name || to, message };
}

export function buildCalendarDraft(text: string): PendingCalendarEvent | null {
  const value = normalize(text);
  const now = new Date();
  const start = new Date(now);
  start.setSeconds(0, 0);

  const relativeHours = value.match(/daqui(?: a)? (\d{1,2}|uma|duas|tres|quatro|cinco|seis) horas?/);
  const numberWords: Record<string, number> = {
    uma: 1, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  };
  if (relativeHours) {
    const amount = Number(relativeHours[1]) || numberWords[relativeHours[1]];
    start.setTime(now.getTime() + amount * 3600000);
  } else {
    if (value.includes("depois de amanha")) start.setDate(start.getDate() + 2);
    else if (value.includes("amanha")) start.setDate(start.getDate() + 1);

    const weekdays: Record<string, number> = {
      domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
    };
    const weekday = Object.entries(weekdays).find(([name]) => value.includes(name));
    if (weekday) {
      let distance = (weekday[1] - start.getDay() + 7) % 7;
      if (distance === 0) distance = 7;
      start.setDate(start.getDate() + distance);
    }

    let hour: number | null = null;
    let minute = 0;
    if (value.includes("meio-dia")) hour = 12;
    else if (value.includes("meia-noite")) hour = 0;
    else if (value.includes("fim da tarde") || value.includes("final da tarde")) hour = 18;
    else {
      const clock = value.match(/(?:as|pelas) (\d{1,2})(?::|h)?(\d{2})?/);
      if (clock) {
        hour = Number(clock[1]);
        minute = Number(clock[2] || 0);
      }
    }
    if (hour === null && !relativeHours) return null;
    if (hour !== null) start.setHours(hour, minute, 0, 0);
  }

  const fallback = value.includes("reuniao") ? "Reunião" : "Compromisso";
  const title = text
    .replace(/^jarvis[, ]*/i, "")
    .replace(/\b(?:agende|agendar|marque|marcar|crie|criar)\b/gi, "")
    .replace(/\b(?:uma?|o)?\s*(?:reunião|reuniao|evento|compromisso)\b/gi, "")
    .replace(/\b(?:para\s+)?(?:hoje|amanhã|amanha|depois de amanhã|depois de amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|daqui).*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:sobre|para)\s+/i, "") || fallback;
  const end = new Date(start.getTime() + 3600000);
  return { title, start: start.toISOString(), end: end.toISOString(), reminderMinutes: null };
}

export function formatCalendar(event: PendingCalendarEvent) {
  const date = new Date(event.start);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
