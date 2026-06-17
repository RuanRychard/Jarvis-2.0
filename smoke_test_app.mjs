import fs from "node:fs";
import vm from "node:vm";

function element() {
  return {
    value: "",
    textContent: "",
    innerHTML: "",
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    append() {},
    focus() {},
    reset() {},
    scrollTop: 0,
    scrollHeight: 0
  };
}

const storage = new Map();
const context = {
  console,
  Date,
  Intl,
  URL,
  fetch,
  setTimeout,
  clearTimeout,
  AbortController,
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  },
  navigator: {},
  document: {
    querySelector: () => element(),
    querySelectorAll: () => [],
    createElement: () => element()
  },
  window: {
    location: { hostname: "127.0.0.1", protocol: "http:" },
    setTimeout,
    clearTimeout,
    SpeechRecognition: undefined,
    webkitSpeechRecognition: undefined,
    speechSynthesis: undefined,
    isSecureContext: true
  }
};
context.globalThis = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

const results = {
  spokenIcloud: evaluate(`normalizeSpokenEmail("para ruan ponto rychard arroba i cloud ponto com sobre teste")`),
  spokenGmail: evaluate(`normalizeSpokenEmail("para joao underline silva a roupa ge mail ponto com sobre teste")`),
  knownDomain: evaluate(`normalizeKnownEmailDomain("richard@icloud.com.br")`),
  relativeTime: evaluate(`Boolean(extractCalendarStart("agende uma reuniao daqui 2 horas"))`),
  relativeWordHours: evaluate(`Boolean(extractCalendarStart("agende uma reuniao daqui duas horas"))`),
  relativeWordDays: evaluate(`new Date(extractCalendarStart("agende uma reuniao daqui tres dias as 14")).getHours()`),
  fridayFollowup: evaluate(`hasCalendarDate("agende uma reuniao para sexta-feira") && !hasCalendarTime("agende uma reuniao para sexta-feira") && hasCalendarTime("as 15 horas")`),
  bareMeetingHasNoTime: evaluate(`hasCalendarTime("agende uma reuniao para sexta-feira")`),
  numericHour: evaluate(`extractNaturalCalendarTime("as 15")?.hour`),
  wordHour: evaluate(`extractNaturalCalendarTime("as duas e meia da tarde")?.hour + ":" + extractNaturalCalendarTime("as duas e meia da tarde")?.minute`),
  wordPeriodHour: evaluate(`extractNaturalCalendarTime("duas da tarde")?.hour`),
  noon: evaluate(`extractNaturalCalendarTime("ao meio-dia")?.hour`),
  endOfAfternoon: evaluate(`extractNaturalCalendarTime("no final da tarde")?.hour`),
  voiceCalendarCorrection: evaluate(`correctVoiceTranscript("agenda uma reuniao sexta feira ao meio dia")`),
  operationsContactCount: evaluate(`(() => {
    const previous = state.contacts;
    state.contacts = [{ name: "Ruan", email: "ruan@example.com", updatedAt: "" }];
    renderOperations();
    const count = els.contactsBadge.textContent;
    state.contacts = previous;
    renderOperations();
    return count;
  })()`),
  operationsPendingCount: evaluate(`(() => {
    const previousDraft = state.pendingEmailDraft;
    const previousEvent = state.pendingCalendarEvent;
    state.pendingEmailDraft = { to: "ruan@example.com", subject: "Teste", message: "Mensagem" };
    state.pendingCalendarEvent = { title: "Reuniao", start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() };
    renderOperations();
    const count = els.pendingBadge.textContent;
    state.pendingEmailDraft = previousDraft;
    state.pendingCalendarEvent = previousEvent;
    renderOperations();
    return count;
  })()`),
  operationsButtonAction: evaluate(`createPanelButton("Confirmar", "confirm-event", "pending").dataset.pendingAction`),
  whatsappPhone: evaluate(`normalizeWhatsAppPhone("(11) 98765-4321")`),
  whatsappBody: evaluate(`extractWhatsAppMessageBody("mande no whatsapp para Ruan dizendo que vou chegar as 15 horas")`),
  whatsappRecipient: evaluate(`extractWhatsAppRecipientName("mande no whatsapp para Ruan dizendo que vou chegar as 15 horas")`),
  whatsappPrepareCommand: evaluate(`isPrepareWhatsAppCommand("mande no whatsapp para Ruan dizendo que vou chegar as 15 horas")`),
  whatsappConfirmCommand: evaluate(`isConfirmWhatsAppCommand("confirmar whatsapp")`),
  whatsappContactPhone: evaluate(`(() => {
    const previous = state.contacts;
    state.contacts = [{ name: "Ruan", email: "", phone: "+5511987654321", updatedAt: "" }];
    const phone = resolveWhatsAppContact("mande no whatsapp para Ruan dizendo que teste")?.phone;
    state.contacts = previous;
    return phone;
  })()`),
  whatsappSaveContact: evaluate(`(() => {
    const previous = state.contacts;
    state.contacts = [];
    const reply = handleContactCommand("salve o whatsapp do Ruan como 11 98765 4321");
    const saved = state.contacts[0];
    state.contacts = previous;
    return reply.includes("Contato salvo") && saved?.name === "Ruan" && saved?.phone === "+5511987654321";
  })()`),
  whatsappPendingPreview: evaluate(`(() => {
    const previousContacts = state.contacts;
    const previousPending = state.pendingWhatsAppMessage;
    state.contacts = [{ name: "Ruan", email: "", phone: "+5511987654321", updatedAt: "" }];
    prepareWhatsAppMessage("mande no whatsapp para Ruan dizendo que vou chegar as 15 horas");
    const result = state.pendingWhatsAppMessage?.to + "|" + state.pendingWhatsAppMessage?.message;
    state.contacts = previousContacts;
    state.pendingWhatsAppMessage = previousPending;
    return result;
  })()`),
  reminderMinutes: evaluate(`extractCalendarReminder("agende uma reuniao amanha as 15 horas e me avise 30 minutos antes")`),
  reminderHours: evaluate(`extractCalendarReminder("agende uma reuniao amanha as 15 horas e lembre me 2 horas antes")`),
  reminderDefault: evaluate(`extractCalendarReminder("agende uma reuniao amanha as 15 horas")`),
  reminderEventTitle: evaluate(`parseCalendarEvent("agende uma reuniao amanha as 15 horas e me avise 30 minutos antes").title`),
  spelling: evaluate(`repairPortugueseText("Reunião Amanhá. Ol¡, você está bem?")`)
};

const expected = {
  spokenIcloud: "ruan.rychard@icloud.com",
  spokenGmail: "joao_silva@gmail.com",
  knownDomain: "richard@icloud.com",
  relativeTime: true,
  relativeWordHours: true,
  relativeWordDays: 14,
  fridayFollowup: true,
  bareMeetingHasNoTime: false,
  numericHour: 15,
  wordHour: "14:30",
  wordPeriodHour: 14,
  noon: 12,
  endOfAfternoon: 18,
  voiceCalendarCorrection: "agende uma reuniao sexta-feira ao meio-dia",
  operationsContactCount: "1",
  operationsPendingCount: "2",
  operationsButtonAction: "confirm-event",
  whatsappPhone: "+5511987654321",
  whatsappBody: "vou chegar as 15 horas",
  whatsappRecipient: "Ruan",
  whatsappPrepareCommand: true,
  whatsappConfirmCommand: true,
  whatsappContactPhone: "+5511987654321",
  whatsappSaveContact: true,
  whatsappPendingPreview: "+5511987654321|vou chegar as 15 horas",
  reminderMinutes: 30,
  reminderHours: 120,
  reminderDefault: null,
  reminderEventTitle: "Reunião",
  spelling: "Reunião Amanhã. Olá, você está bem?"
};

const failures = Object.keys(expected).filter((key) => results[key] !== expected[key]);
console.log(JSON.stringify({ passed: failures.length === 0, results, failures }));
if (failures.length) process.exit(1);
