const storageKey = "jarvis-clean-state";
const limits = {
  messageLength: 1200,
  replyLength: 2200,
  taskLength: 180,
  locationLength: 80,
  maxMessages: 60,
  maxTasks: 50,
  maxPriorities: 10,
  maxContacts: 100,
  requestTimeoutMs: 30000,
  maxAudioBytes: 6 * 1024 * 1024
};

const personalityProfile = {
  assistantName: "Jarvis",
  userName: "Chefe",
  tone: "sofisticado, educado, extremamente competente e levemente espirituoso",
  priorities: [
    "Conseguir um estagio em TI",
    "Comprar uma moto",
    "Estruturar melhor a vida financeira"
  ],
  behavior: [
    "Responder com clareza, calma e precisao",
    "Cobrar procrastinacao com firmeza elegante",
    "Avisar quando nao tiver certeza",
    "Transformar objetivos grandes em proximas acoes pequenas",
    "Aprender expressoes e preferencias do usuario com o tempo"
  ],
  limits: [
    "Pedir confirmacao antes de acoes sensiveis",
    "Nao inventar informacoes",
    "Apontar riscos quando a decisao envolver carreira, dinheiro ou dados atuais"
  ]
};

const defaults = {
  assistantName: "Jarvis",
  userName: "Chefe",
  tone: "estrategico",
  voiceMode: "on",
  voiceConversation: "on",
  voiceProvider: "browser",
  voiceName: "auto",
  voiceRate: "0.80",
  voicePitch: "0.68",
  ttsWebhookUrl: "",
  webhookUrl: "",
  webhookToken: "",
  webhookHealthy: false,
  pendingEmailDraft: null,
  pendingWhatsAppMessage: null,
  pendingCalendarEvent: null,
  pendingCalendarAction: null,
  pendingCalendarRequest: "",
  calendarEvents: [],
  contacts: [],
  weatherLocation: "",
  tasks: [],
  priorities: [],
  integrations: {
    email: "not_configured",
    calendar: "not_configured",
    whatsapp: "not_configured",
    instagram: "not_configured"
  },
  permissions: {
    readMessages: false,
    sendMessages: false,
    readSocial: false,
    postSocial: false,
    requireConfirmation: true
  },
  messages: [
    {
      role: "assistant",
      text: "Sistema pronto, Chefe. Estou em modo local, com memoria neste navegador e foco nas suas prioridades."
    }
  ]
};

const state = loadState();
state.assistantName ||= "Jarvis";
state.userName ||= "Chefe";
state.tone ||= "estrategico";
state.voiceMode ||= "on";
state.voiceRate ||= "0.80";
state.voicePitch ||= "0.68";
state.integrations ||= { ...defaults.integrations };
if (!state.calendarSetupVersion || state.calendarSetupVersion < 1) {
  state.integrations.calendar = "configured";
  state.calendarSetupVersion = 1;
  localStorage.setItem(storageKey, JSON.stringify(state));
}
pruneState();

const els = {
  conversation: document.querySelector("#conversation"),
  composer: document.querySelector("#composer"),
  input: document.querySelector("#messageInput"),
  micButton: document.querySelector("#micButton"),
  voiceToggle: document.querySelector("#voiceToggle"),
  voiceStatus: document.querySelector("#voiceStatus"),
  listenState: document.querySelector("#listenState"),
  assistantTitle: document.querySelector("#assistantTitle"),
  taskCount: document.querySelector("#taskCount"),
  priorityCount: document.querySelector("#priorityCount"),
  contextScore: document.querySelector("#contextScore"),
  connectionStatus: document.querySelector("#connectionStatus"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  closeSettings: document.querySelector("#closeSettings"),
  voiceProvider: document.querySelector("#voiceProvider"),
  voiceName: document.querySelector("#voiceName"),
  voiceRate: document.querySelector("#voiceRate"),
  voicePitch: document.querySelector("#voicePitch"),
  ttsWebhookUrl: document.querySelector("#ttsWebhookUrl"),
  webhookUrl: document.querySelector("#webhookUrl"),
  webhookToken: document.querySelector("#webhookToken"),
  operationsButton: document.querySelector("#operationsButton"),
  operationsPanel: document.querySelector("#operationsPanel"),
  closeOperations: document.querySelector("#closeOperations"),
  contactsBadge: document.querySelector("#contactsBadge"),
  pendingBadge: document.querySelector("#pendingBadge"),
  contactsList: document.querySelector("#contactsList"),
  pendingList: document.querySelector("#pendingList"),
  contactForm: document.querySelector("#contactForm"),
  contactName: document.querySelector("#contactName"),
  contactEmail: document.querySelector("#contactEmail"),
  contactPhone: document.querySelector("#contactPhone"),
  contactEditKey: document.querySelector("#contactEditKey"),
  cancelContactEdit: document.querySelector("#cancelContactEdit")
};

let recognition = null;
let isListening = false;
let microphoneReady = false;
let shouldKeepListening = false;
let isSpeaking = false;
let memorySyncTimer = null;
let voiceTranscript = "";
let voiceSubmitTimer = null;
let voiceSubmitting = false;

hydrateSettings();
setupVoice();
setupSpeechVoices();
render();

els.composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = sanitizeUserText(els.input.value);
  if (!text) return;

  els.input.value = "";
  addMessage("user", text);
  await respond(text);
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    els.input.value = button.dataset.prompt;
    els.input.focus();
  });
});

[els.voiceProvider, els.voiceName, els.voiceRate, els.voicePitch, els.ttsWebhookUrl, els.webhookUrl, els.webhookToken].forEach((field) => {
  field.addEventListener("input", () => {
    state[field.id] = field.value.trim();
    saveState();
    render();
  });
});

els.settingsButton.addEventListener("click", () => {
  els.operationsPanel.classList.remove("open");
  els.settingsPanel.classList.add("open");
});

els.closeSettings.addEventListener("click", () => {
  els.settingsPanel.classList.remove("open");
});

els.operationsButton.addEventListener("click", () => {
  els.settingsPanel.classList.remove("open");
  els.operationsPanel.classList.add("open");
  renderOperations();
});

els.closeOperations.addEventListener("click", () => {
  els.operationsPanel.classList.remove("open");
});

document.querySelectorAll("[data-operations-tab]").forEach((button) => {
  button.addEventListener("click", () => selectOperationsTab(button.dataset.operationsTab));
});

els.contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveContactFromPanel();
});

els.cancelContactEdit.addEventListener("click", resetContactForm);

els.contactsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-contact-action]");
  if (!button) return;
  if (button.dataset.contactAction === "edit") beginContactEdit(button.dataset.contactKey);
  if (button.dataset.contactAction === "delete") deleteContactFromPanel(button.dataset.contactKey);
});

els.pendingList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-pending-action]");
  if (!button) return;
  button.disabled = true;
  await handlePendingPanelAction(button.dataset.pendingAction);
  renderOperations();
});

els.micButton.addEventListener("click", async () => {
  if (!recognition) {
    setVoiceStatus("Reconhecimento de voz indisponivel neste navegador.");
    return;
  }

  if (isListening) {
    shouldKeepListening = false;
    recognition.stop();
    return;
  }

  shouldKeepListening = true;
  await startListening();
});

els.voiceToggle.addEventListener("click", () => {
  state.voiceMode = state.voiceMode === "on" ? "off" : "on";
  saveState();
  render();
  setVoiceStatus(state.voiceMode === "on" ? "Resposta falada ativada." : "Resposta falada desativada.");
});

async function respond(text) {
  text = sanitizeUserText(text);
  if (!text) return;

  if (isConfirmWhatsAppCommand(text)) {
    await confirmPendingWhatsAppSend();
    return;
  }

  if (isCancelWhatsAppCommand(text)) {
    cancelPendingWhatsAppSend();
    return;
  }

  if (isConfirmEmailSendCommand(text)) {
    await confirmPendingEmailSend();
    return;
  }

  if (isCancelEmailSendCommand(text)) {
    cancelPendingEmailSend();
    return;
  }

  if (isConfirmCalendarEventCommand(text)) {
    await confirmPendingCalendarEvent();
    return;
  }

  if (isConfirmCalendarChangeCommand(text)) {
    await confirmPendingCalendarChange();
    return;
  }

  if (isCancelCalendarEventCommand(text)) {
    cancelPendingCalendarEvent();
    return;
  }

  if (state.pendingEmailDraft && isReviseEmailDraftCommand(text)) {
    await revisePendingEmailDraft(text);
    return;
  }

  if (state.pendingWhatsAppMessage && isReviseWhatsAppCommand(text)) {
    revisePendingWhatsAppMessage(text);
    return;
  }

  if (isPrepareWhatsAppCommand(text)) {
    prepareWhatsAppMessage(text);
    return;
  }

  if (isCreateCalendarEventCommand(text)) {
    prepareCalendarEvent(text);
    return;
  }

  if (state.pendingCalendarRequest && hasCalendarTime(text)) {
    const request = `${state.pendingCalendarRequest} ${text}`;
    state.pendingCalendarRequest = "";
    prepareCalendarEvent(request);
    return;
  }

  if (isDeleteCalendarEventCommand(text) || isUpdateCalendarEventCommand(text)) {
    prepareCalendarChange(text);
    return;
  }

  if (await handleCommand(text)) return;

  showThinking();

  try {
    const remote = await askWebhook(text);
    if (remote) {
      replaceThinking(remote);
      return;
    }
  } catch (error) {
    replaceThinking(`Nao consegui falar com o n8n agora (${error.message}). Fiquei em modo local e preservei sua mensagem.`);
    return;
  }

  replaceThinking(createLocalReply(text));
}

async function handleCommand(text) {
  const normalized = text.toLowerCase();

  const contactReply = handleContactCommand(text);
  if (contactReply) {
    addMessage("assistant", contactReply);
    speak(contactReply);
    return true;
  }

  if (normalized === "/limpar") {
    state.messages = [];
    saveState();
    addMessage("assistant", "Historico limpo. Mantive suas configuracoes.");
    return true;
  }

  if (normalized === "/exportar") {
    const payload = JSON.stringify(state, null, 2);
    const copied = await copyToClipboard(payload);
    addMessage("assistant", copied ? "Estado exportado para a area de transferencia." : "Nao consegui copiar automaticamente. Use /obsidian texto para mostrar o conteudo na conversa.");
    return true;
  }

  if (["/obsidian", "obsidian", "exportar obsidian", "memoria obsidian", "memória obsidian"].includes(normalized)) {
    const markdown = buildObsidianExport();
    const copied = await copyToClipboard(markdown);
    if (copied) {
      addMessage("assistant", "Resumo em Markdown copiado para a area de transferencia. Agora va ao Obsidian e use Ctrl+V no final da nota.");
    } else {
      addMessage("assistant", "Nao consegui copiar automaticamente. Vou mostrar o Markdown abaixo para voce copiar manualmente.");
      addMessage("assistant", markdown);
    }
    return true;
  }

  if (["/obsidian texto", "obsidian texto", "mostrar obsidian"].includes(normalized)) {
    addMessage("assistant", buildObsidianExport());
    return true;
  }

  if (["/sincronizar", "/memoria", "sincronizar memoria", "salvar memoria"].includes(normalized)) {
    await syncMemoryToServer({ appendHistory: true });
    addMessage("assistant", "Memoria local sincronizada, Chefe. Atualizei o JSON, as tarefas e o historico do Obsidian.");
    return true;
  }

  if (normalized === "/perfil") {
    addMessage("assistant", `Perfil ativo: ${state.assistantName || "Jarvis"} chamando voce de ${state.userName || "Chefe"}, em tom ${state.tone}. Prioridades: ${personalityProfile.priorities.join(", ")}.`);
    return true;
  }

  if (normalized === "/voz") {
    addMessage("assistant", getVoiceDiagnostic());
    return true;
  }

  if (["/vozjarvis", "voz jarvis", "voz do jarvis", "modo voz jarvis"].includes(normalized)) {
    applyJarvisVoicePreset();
    const reply = "Modo de voz cinematografico ativado, Chefe. Vou falar de forma mais calma, grave e precisa.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/testetts", "teste tts", "testar voz externa"].includes(normalized)) {
    const reply = "Teste de voz externa, Chefe. Se voce ouviu isso com a voz customizada, o TTS esta conectado.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/testevoz", "teste voz", "testar voz"].includes(normalized)) {
    const reply = "Sistema de voz calibrado, Chefe. Ritmo calmo, presença firme e resposta objetiva.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/testarn8n", "/teste n8n", "testar n8n"].includes(normalized)) {
    const reply = await testWebhookConnection();
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/gmailon", "/gmail on", "ativar gmail", "gmail conectado"].includes(normalized)) {
    state.integrations.email = "configured";
    state.permissions.readMessages = true;
    state.permissions.requireConfirmation = true;
    saveState();
    const reply = "Gmail marcado como conectado, Chefe. Vou permitir leitura e manter envio sempre dependente da sua confirmacao.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/gmailoff", "/gmail off", "desativar gmail", "gmail desconectado"].includes(normalized)) {
    state.integrations.email = "not_configured";
    state.permissions.readMessages = false;
    saveState();
    const reply = "Gmail marcado como desconectado, Chefe. Nao vou fingir acesso aos seus emails.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/agendaon", "/agenda on", "ativar agenda", "agenda conectada"].includes(normalized)) {
    state.integrations.calendar = "configured";
    state.permissions.requireConfirmation = true;
    saveState();
    const reply = "Google Agenda marcado como conectado, Chefe. Consultas estao liberadas e criacoes continuam exigindo confirmacao.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/agendaoff", "/agenda off", "desativar agenda", "agenda desconectada"].includes(normalized)) {
    state.integrations.calendar = "not_configured";
    saveState();
    const reply = "Google Agenda marcado como desconectado, Chefe.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/whatsappon", "/whatsapp on", "ativar whatsapp", "whatsapp conectado"].includes(normalized)) {
    state.integrations.whatsapp = "configured";
    state.permissions.requireConfirmation = true;
    saveState();
    const reply = "WhatsApp Business marcado como conectado, Chefe. Todo envio continuara exigindo sua confirmacao.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/whatsappoff", "/whatsapp off", "desativar whatsapp", "whatsapp desconectado"].includes(normalized)) {
    state.integrations.whatsapp = "not_configured";
    saveState();
    const reply = "WhatsApp marcado como desconectado, Chefe. Nenhuma mensagem sera enviada.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (["/limpartarefas", "/limpar tarefas", "limpar tarefas", "limpe minhas tarefas"].includes(normalized)) {
    state.tasks = [];
    state.priorities = [];
    saveState();
    const reply = "Tarefas e prioridades limpas, Chefe.";
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  if (isSetWeatherLocationCommand(normalized)) {
    const location = extractWeatherLocation(text);
    if (!location) {
      addMessage("assistant", "Chefe, me diga a cidade. Exemplo: minha cidade e Sao Paulo.");
      return true;
    }
    state.weatherLocation = location;
    saveState();
    const reply = `Cidade padrao definida, Chefe: ${location}.`;
    addMessage("assistant", reply);
    speak(reply);
    return true;
  }

  const actionReply = await handleVoiceAction(text);
  if (actionReply) {
    addMessage("assistant", actionReply);
    speak(actionReply);
    return true;
  }

  return false;
}

async function copyToClipboard(text) {
  if (!navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function askWebhook(text, overrides = {}) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) return "";

  const headers = { "Content-Type": "application/json" };
  if (state.webhookToken) headers["X-Jarvis-Token"] = state.webhookToken;
  const actionIntent = overrides.actionIntent || detectExternalAction(text);

  const response = await fetchWithTimeout(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: truncateText(text, limits.messageLength),
      profile: {
        assistantName: state.assistantName,
        userName: state.userName,
        tone: state.tone,
        inputMode: "voice",
        outputMode: state.voiceMode === "on" ? "spoken" : "text",
        personality: personalityProfile,
        systemPrompt: buildSystemPrompt(),
        integrations: state.integrations,
        permissions: state.permissions,
        actionIntent,
        weatherLocation: state.weatherLocation
      },
      memory: {
        tasks: state.tasks.slice(0, 12),
        priorities: state.priorities.slice(0, 6),
        recentMessages: state.messages.slice(-8).map(({ role, text }) => ({
          role,
          text: truncateText(text, 600)
        }))
      }
    })
  });

  if (!response.ok) throw new Error(`Webhook respondeu ${response.status}`);

  const raw = await response.text();
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    return raw;
  }

  integrateSuggestedTasks(data);
  integratePendingDraft(data);
  integrateCalendarEvents(data);
  let reply = repairPortugueseText(data.reply || data.response || data.message || "");
  if (data.pendingEmailDraft?.message) {
    const preview = repairPortugueseText(data.pendingEmailDraft.message)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);
    reply = `${reply} Previa: ${preview}${preview.length === 240 ? "..." : ""}`;
  }
  reply = truncateText(reply, limits.replyLength);
  state.webhookHealthy = Boolean(reply);
  saveState();
  return reply;
}

async function confirmPendingEmailSend() {
  if (!state.pendingEmailDraft?.to || !state.pendingEmailDraft?.message) {
    addMessage("assistant", "Chefe, nao ha rascunho pendente para enviar.");
    return;
  }

  showThinking();

  try {
    const draft = {
      ...state.pendingEmailDraft,
      subject: repairPortugueseText(state.pendingEmailDraft.subject),
      message: repairPortugueseText(state.pendingEmailDraft.message)
    };
    state.pendingEmailDraft = draft;
    saveState();
    const reply = await askWebhook("Confirmar envio do rascunho pendente.", {
      actionIntent: {
        service: "email",
        mode: "send",
        operation: "send_email_confirmed",
        to: draft.to,
        subject: draft.subject,
        message: draft.message,
        draftId: draft.draftId,
        confirmed: true,
        requiresConfirmation: false
      }
    });
    state.pendingEmailDraft = null;
    replaceThinking(reply || "Email enviado, Chefe.");
  } catch (error) {
    replaceThinking(`Nao consegui enviar o email agora (${error.message}). Mantive o rascunho pendente.`);
  }
}

function cancelPendingEmailSend() {
  if (!state.pendingEmailDraft) {
    addMessage("assistant", "Chefe, nao ha envio pendente para cancelar.");
    return;
  }

  state.pendingEmailDraft = null;
  saveState();
  addMessage("assistant", "Envio cancelado, Chefe. O rascunho no Gmail nao foi enviado.");
}

function isPrepareWhatsAppCommand(text) {
  const value = normalizeText(text);
  const channel = ["whatsapp", "whats app", "zap", "zapzap"].some((word) => value.includes(word));
  const action = ["mande", "mandar", "envie", "enviar", "prepare", "preparar", "escreva", "escrever"].some((word) => value.includes(word));
  return channel && action;
}

function isConfirmWhatsAppCommand(text) {
  const value = normalizeText(text);
  return [
    "confirmar whatsapp", "confirme o whatsapp", "confirmar mensagem do whatsapp",
    "pode enviar no whatsapp", "enviar mensagem do whatsapp"
  ].some((phrase) => value.includes(phrase));
}

function isCancelWhatsAppCommand(text) {
  const value = normalizeText(text);
  return [
    "cancelar whatsapp", "cancele o whatsapp", "cancelar mensagem do whatsapp",
    "nao enviar no whatsapp", "desistir da mensagem do whatsapp"
  ].some((phrase) => value.includes(phrase));
}

function isReviseWhatsAppCommand(text) {
  const value = normalizeText(text);
  return ["troque", "mude", "altere", "corrija", "adicione", "remova"].some((word) => value.includes(word)) &&
    ["mensagem", "texto", "corpo", "destinatario", "numero", "telefone"].some((word) => value.includes(word));
}

function prepareWhatsAppMessage(text) {
  const phone = extractWhatsAppPhone(text);
  const contact = resolveWhatsAppContact(text);
  const to = phone || contact?.phone || "";
  const contactName = contact?.name || extractWhatsAppRecipientName(text);
  const message = extractWhatsAppMessageBody(text);

  if (!to) {
    addMessage("assistant", "Chefe, preciso do contato ou numero com DDD. Salve o telefone no painel @ ou diga o numero na mensagem.");
    return;
  }
  if (!message) {
    addMessage("assistant", "Chefe, entendi o destinatario, mas preciso do texto. Diga: mande no WhatsApp para Ruan dizendo que vou chegar as 15 horas.");
    return;
  }

  state.pendingWhatsAppMessage = {
    to,
    contactName: contactName || formatPhoneForDisplay(to),
    message: truncateText(repairPortugueseText(message), 1200),
    createdAt: new Date().toISOString()
  };
  saveState();
  const reply =
    `Mensagem de WhatsApp preparada, Chefe. Para: ${state.pendingWhatsAppMessage.contactName}. ` +
    `Previa: ${state.pendingWhatsAppMessage.message}. Para enviar, diga: confirmar WhatsApp.`;
  addMessage("assistant", reply);
  speak(reply);
}

function revisePendingWhatsAppMessage(text) {
  const pending = state.pendingWhatsAppMessage;
  if (!pending) {
    addMessage("assistant", "Chefe, nao ha mensagem de WhatsApp pendente para alterar.");
    return;
  }

  const phone = extractWhatsAppPhone(text);
  const contact = resolveWhatsAppContact(text);
  const replacement = extractWhatsAppRevisionBody(text);
  if (phone || contact?.phone) {
    pending.to = phone || contact.phone;
    pending.contactName = contact?.name || formatPhoneForDisplay(pending.to);
  }
  if (replacement) pending.message = truncateText(repairPortugueseText(replacement), 1200);
  pending.revisedAt = new Date().toISOString();
  saveState();

  const reply =
    `Mensagem alterada, Chefe. Para: ${pending.contactName}. Previa: ${pending.message}. ` +
    "Para enviar, diga: confirmar WhatsApp.";
  addMessage("assistant", reply);
  speak(reply);
}

async function confirmPendingWhatsAppSend() {
  const pending = state.pendingWhatsAppMessage;
  if (!pending?.to || !pending?.message) {
    addMessage("assistant", "Chefe, nao ha mensagem de WhatsApp pendente para enviar.");
    return;
  }
  if (state.integrations.whatsapp !== "configured") {
    addMessage("assistant", "Chefe, a mensagem esta pronta, mas a credencial oficial do WhatsApp Business ainda precisa ser conectada no n8n.");
    return;
  }

  showThinking();
  try {
    const reply = await askWebhook("Confirmar envio da mensagem de WhatsApp pendente.", {
      actionIntent: {
        service: "whatsapp",
        mode: "send",
        operation: "send_whatsapp_confirmed",
        confirmed: true,
        to: pending.to,
        message: pending.message,
        requiresConfirmation: false
      }
    });
    state.pendingWhatsAppMessage = null;
    replaceThinking(reply || "Mensagem enviada pelo WhatsApp, Chefe.");
  } catch (error) {
    replaceThinking(`Nao consegui enviar no WhatsApp agora (${error.message}). Mantive a mensagem pendente.`);
  }
}

function cancelPendingWhatsAppSend() {
  if (!state.pendingWhatsAppMessage) {
    addMessage("assistant", "Chefe, nao ha mensagem de WhatsApp pendente para cancelar.");
    return;
  }
  state.pendingWhatsAppMessage = null;
  saveState();
  addMessage("assistant", "Mensagem de WhatsApp cancelada, Chefe. Nada foi enviado.");
}

function extractWhatsAppPhone(text) {
  const match = String(text || "").match(/(?:\+?\d[\d\s().-]{8,}\d)/);
  return match ? normalizeWhatsAppPhone(match[0]) : "";
}

function normalizeWhatsAppPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) digits = `55${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "";
}

function formatPhoneForDisplay(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const local = digits.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`;
  }
  return phone;
}

function resolveWhatsAppContact(text) {
  const requested = normalizeContactName(extractWhatsAppRecipientName(text));
  if (!requested) return null;
  return state.contacts.find((contact) => contact.phone && normalizeContactName(contact.name) === requested) || null;
}

function extractWhatsAppRecipientName(text) {
  const match = String(text || "").match(
    /(?:whatsapp|whats app|zap|zapzap)\s+(?:para|pro|pra|do|da|de)?\s*(?:o|a)?\s*([^,.;?!]+?)(?=\s+(?:dizendo|falando|avisando|que|com a mensagem|com o texto)\b|$)/i
  ) || String(text || "").match(
    /(?:para|pro|pra)\s+(?:o|a)?\s*([^,.;?!]+?)(?=\s+(?:no|pelo)\s+(?:whatsapp|zap)|\s+(?:dizendo|falando|avisando|que)\b|$)/i
  );
  return match?.[1] ? formatContactName(match[1].replace(/\b(?:no|pelo)\s+(?:whatsapp|zap).*$/i, "")) : "";
}

function extractWhatsAppMessageBody(text) {
  const match = String(text || "").match(/(?:dizendo|falando|avisando)\s+(?:que\s+)?(.+)$/i) ||
    String(text || "").match(/(?:com a mensagem|com o texto)\s+(.+)$/i);
  return match?.[1] ? match[1].replace(/[.!?]+$/g, "").trim() : "";
}

function extractWhatsAppRevisionBody(text) {
  const match = String(text || "").match(
    /(?:mensagem|texto|corpo)\s+(?:para|por|como)\s+(.+)$/i
  );
  return match?.[1] ? match[1].replace(/[.!?]+$/g, "").trim() : "";
}

function isCreateCalendarEventCommand(text) {
  const value = normalizeText(text);
  const calendarWord = ["agenda", "evento", "compromisso", "reuniao"].some((word) => value.includes(word));
  const createWord = ["crie", "criar", "adicione", "adicionar", "agende", "agendar", "marque", "marcar"].some((word) => value.includes(word));
  return calendarWord && createWord;
}

function isConfirmCalendarEventCommand(text) {
  const value = normalizeText(text);
  return ["confirmar evento", "confirme o evento", "confirmar compromisso", "pode agendar"].some((phrase) => value.includes(phrase));
}

function isCancelCalendarEventCommand(text) {
  const value = normalizeText(text);
  return [
    "cancelar evento pendente", "cancele o evento pendente",
    "nao agendar", "desistir do evento", "cancelar criacao"
  ].some((phrase) => value.includes(phrase));
}

function isConfirmCalendarChangeCommand(text) {
  const value = normalizeText(text);
  return [
    "confirmar alteracao", "confirme a alteracao", "confirmar exclusao",
    "confirme a exclusao", "pode alterar", "pode excluir"
  ].some((phrase) => value.includes(phrase));
}

function isDeleteCalendarEventCommand(text) {
  const value = normalizeText(text);
  const action = ["exclua", "excluir", "apague", "apagar", "remova", "remover", "cancele", "cancelar"].some((word) => value.includes(word));
  const target = ["evento", "compromisso", "reuniao", "agenda"].some((word) => value.includes(word));
  return action && target && !isCancelCalendarEventCommand(text);
}

function isUpdateCalendarEventCommand(text) {
  const value = normalizeText(text);
  const action = ["altere", "alterar", "mude", "mudar", "troque", "trocar", "remarque", "remarcar"].some((word) => value.includes(word));
  const target = ["evento", "compromisso", "reuniao"].some((word) => value.includes(word));
  return action && target;
}

function prepareCalendarChange(text) {
  const event = findCalendarEventForCommand(text);
  if (!event) {
    addMessage("assistant", "Chefe, nao encontrei esse compromisso na ultima consulta. Primeiro pergunte: quais sao meus proximos compromissos?");
    return;
  }

  if (isDeleteCalendarEventCommand(text)) {
    state.pendingCalendarAction = { type: "delete", event };
    saveState();
    const reply = `Exclusao preparada, Chefe: ${event.title}, em ${formatCalendarDate(event.start)}. Para excluir, diga: confirmar exclusao.`;
    addMessage("assistant", reply);
    speak(reply);
    return;
  }

  const start = extractCalendarStart(text);
  if (!start) {
    addMessage("assistant", "Chefe, encontrei o compromisso, mas preciso da nova data e do novo horario.");
    return;
  }
  const originalDuration = Math.max(15, Math.round((new Date(event.end) - new Date(event.start)) / 60000) || 60);
  const end = new Date(new Date(start).getTime() + originalDuration * 60000).toISOString();
  state.pendingCalendarAction = {
    type: "update",
    event,
    changes: { start, end }
  };
  saveState();
  const reply =
    `Alteracao preparada, Chefe: ${event.title}. Novo inicio: ${formatCalendarDate(start)}. ` +
    `Para aplicar, diga: confirmar alteracao.`;
  addMessage("assistant", reply);
  speak(reply);
}

async function confirmPendingCalendarChange() {
  const pending = state.pendingCalendarAction;
  if (!pending?.event?.id) {
    addMessage("assistant", "Chefe, nao ha alteracao ou exclusao pendente.");
    return;
  }

  showThinking();
  try {
    const deleting = pending.type === "delete";
    const reply = await askWebhook(deleting ? "Confirmar exclusao do evento." : "Confirmar alteracao do evento.", {
      actionIntent: {
        service: "calendar",
        mode: "write",
        operation: deleting ? "delete_calendar_event_confirmed" : "update_calendar_event_confirmed",
        confirmed: true,
        eventId: pending.event.id,
        title: pending.event.title,
        start: pending.changes?.start || pending.event.start,
        end: pending.changes?.end || pending.event.end,
        requiresConfirmation: false
      }
    });
    state.pendingCalendarAction = null;
    replaceThinking(reply || (deleting ? "Evento excluido, Chefe." : "Evento alterado, Chefe."));
  } catch (error) {
    replaceThinking(`Nao consegui concluir a acao agora (${error.message}). Mantive a confirmacao pendente.`);
  }
}

function findCalendarEventForCommand(text) {
  const command = normalizeText(text);
  const candidates = (state.calendarEvents || []).map((event) => {
    const title = normalizeText(event.title);
    const words = title.split(/\s+/).filter((word) => word.length > 2);
    const score = words.filter((word) => command.includes(word)).length;
    return { event, score };
  }).sort((a, b) => b.score - a.score);
  return candidates[0]?.score > 0 ? candidates[0].event : state.calendarEvents?.length === 1 ? state.calendarEvents[0] : null;
}

function prepareCalendarEvent(text) {
  const event = parseCalendarEvent(text);
  if (!event.start) {
    if (hasCalendarDate(text) && !hasCalendarTime(text)) {
      state.pendingCalendarRequest = text;
      saveState();
      addMessage("assistant", "Chefe, sexta-feira entendido. Qual horario devo marcar?");
      return;
    }
    addMessage("assistant", "Chefe, entendi que deseja criar um evento, mas preciso da data e do horario.");
    return;
  }

  state.pendingCalendarRequest = "";
  state.pendingCalendarEvent = event;
  saveState();
  const reply =
    `Evento preparado, Chefe. Titulo: ${event.title}. Inicio: ${formatCalendarDate(event.start)}. ` +
    `Fim: ${formatCalendarDate(event.end)}. ${formatCalendarReminder(event.reminderMinutes)} ` +
    `Para criar no Google Agenda, diga: confirmar evento.`;
  addMessage("assistant", reply);
  speak(reply);
}

async function confirmPendingCalendarEvent() {
  const event = state.pendingCalendarEvent;
  if (!event?.start || !event?.title) {
    addMessage("assistant", "Chefe, nao ha evento pendente para confirmar.");
    return;
  }
  if (state.integrations.calendar !== "configured") {
    addMessage("assistant", "Chefe, o evento esta preparado, mas o Google Agenda ainda precisa ser conectado no n8n.");
    return;
  }

  showThinking();
  try {
    const reply = await askWebhook("Confirmar criacao do evento pendente.", {
      actionIntent: {
        service: "calendar",
        mode: "write",
        operation: "create_calendar_event_confirmed",
        confirmed: true,
        title: event.title,
        start: event.start,
        end: event.end,
        description: event.description || "",
        reminderMinutes: event.reminderMinutes,
        requiresConfirmation: false
      }
    });
    state.pendingCalendarEvent = null;
    replaceThinking(reply || "Evento criado no Google Agenda, Chefe.");
  } catch (error) {
    replaceThinking(`Nao consegui criar o evento agora (${error.message}). Mantive o evento pendente.`);
  }
}

function cancelPendingCalendarEvent() {
  if (!state.pendingCalendarEvent) {
    addMessage("assistant", "Chefe, nao ha evento pendente para cancelar.");
    return;
  }
  state.pendingCalendarEvent = null;
  saveState();
  addMessage("assistant", "Evento pendente cancelado, Chefe. Nada foi criado no Google Agenda.");
}

function cancelPendingCalendarChange() {
  if (!state.pendingCalendarAction) {
    addMessage("assistant", "Chefe, nao ha alteracao ou exclusao pendente.");
    return;
  }
  state.pendingCalendarAction = null;
  saveState();
  addMessage("assistant", "Acao da Agenda cancelada, Chefe. Nenhum compromisso foi alterado.");
}

function parseCalendarEvent(text) {
  const start = extractCalendarStart(text);
  const fallbackTitle = normalizeText(text).includes("reuniao") ? "Reunião" : "Compromisso";
  const reminderMinutes = extractCalendarReminder(text);
  const durationMatch = normalizeText(text).match(/(?:por|durante)\s+([\w]+|\d{1,3})\s*(minutos?|horas?)/);
  const durationAmount = durationMatch ? parsePortugueseNumber(durationMatch[1]) : null;
  const durationMinutes = durationMatch
    ? (durationAmount ?? 1) * (durationMatch[2].startsWith("hora") ? 60 : 1)
    : 60;
  const end = start ? new Date(new Date(start).getTime() + durationMinutes * 60000).toISOString() : "";
  const title = String(text || "")
    .replace(/^jarvis[, ]*/i, "")
    .replace(/\b(?:crie|criar|adicione|adicionar|agende|agendar|marque|marcar)\b/gi, "")
    .replace(/\b(?:um|uma)?\s*(?:evento|compromisso|reuniao|reunião)(?:\s+na\s+agenda)?\b/gi, "")
    .replace(/\b(?:para\s+)?daqui(?:\s+a)?\s+(?:[\w]+|\d{1,3})\s+(?:horas?|dias?)\b.*$/i, "")
    .replace(/\b(?:e\s+)?(?:me\s+)?(?:avise|avisar|lembre|lembrar|notifique|notificar)\s+(?:com\s+)?\d{1,4}\s*(?:minutos?|horas?|dias?)\s+antes\b.*$/i, "")
    .replace(/\b(?:depois de amanha|depois de amanhã|hoje|amanha|amanhã)\b.*$/i, "")
    .replace(/\b(?:proxima\s+|próxima\s+)?(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?\b.*$/i, "")
    .replace(/\b(?:dia\s+\d{1,2}(?:\/\d{1,2})?(?:\/\d{2,4})?)\b.*$/i, "")
    .replace(/\b(?:meio[- ]dia|meia[- ]noite|depois do almoco|depois do almoço|fim da tarde|final da tarde)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:para|sobre|chamado|chamada)\s+/i, "") || fallbackTitle;
  return { title: repairPortugueseText(title), start, end, description: "", reminderMinutes };
}

function extractCalendarStart(text) {
  const value = normalizeText(text);
  const now = new Date();
  const target = new Date(now);
  target.setSeconds(0, 0);

  const relativeHours = value.match(/daqui(?:\s+a)?\s+([\w]+|\d{1,3})\s+horas?/);
  if (relativeHours) {
    const hours = parsePortugueseNumber(relativeHours[1]);
    if (hours !== null) return new Date(now.getTime() + hours * 3600000).toISOString();
  }

  const relativeDays = value.match(/daqui(?:\s+a)?\s+([\w]+|\d{1,3})\s+dias?/);
  if (relativeDays) {
    const days = parsePortugueseNumber(relativeDays[1]);
    if (days !== null) target.setDate(target.getDate() + days);
  }

  if (value.includes("depois de amanha")) target.setDate(target.getDate() + 2);
  else if (value.includes("amanha")) target.setDate(target.getDate() + 1);
  const weekdays = {
    domingo: 0, segunda: 1, terca: 2, quarta: 3,
    quinta: 4, sexta: 5, sabado: 6
  };
  const weekday = Object.entries(weekdays).find(([name]) => value.includes(name));
  if (weekday) {
    let distance = (weekday[1] - target.getDay() + 7) % 7;
    if (distance === 0 || value.includes("proxima") || value.includes("que vem")) distance ||= 7;
    target.setDate(target.getDate() + distance);
  }
  const numericDate = value.match(/\bdia\s+(\d{1,2})(?:\/(\d{1,2}))?(?:\/(\d{2,4}))?/);
  if (numericDate) {
    const year = numericDate[3] ? Number(numericDate[3].length === 2 ? `20${numericDate[3]}` : numericDate[3]) : now.getFullYear();
    const month = numericDate[2] ? Number(numericDate[2]) - 1 : now.getMonth();
    target.setFullYear(year, month, Number(numericDate[1]));
  }

  const namedMonth = value.match(/\bdia\s+(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/);
  if (namedMonth) {
    const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    target.setFullYear(Number(namedMonth[3] || now.getFullYear()), months.indexOf(namedMonth[2]), Number(namedMonth[1]));
  }

  const time = extractNaturalCalendarTime(value);
  if (!time) return "";
  target.setHours(time.hour, time.minute, 0, 0);
  return target.toISOString();
}

function hasCalendarDate(text) {
  const value = normalizeText(text);
  return [
    "hoje", "amanha", "depois de amanha", "segunda", "terca", "quarta",
    "quinta", "sexta", "sabado", "domingo", "daqui"
  ].some((term) => value.includes(term)) || /\bdia\s+\d{1,2}/.test(value);
}

function hasCalendarTime(text) {
  return Boolean(extractNaturalCalendarTime(normalizeText(text))) ||
    /daqui(?:\s+a)?\s+(?:[\w]+|\d{1,3})\s+horas?/.test(normalizeText(text));
}

function extractNaturalCalendarTime(value) {
  const periods = [
    { pattern: /\bmeia[- ]noite\b/, hour: 0, minute: 0 },
    { pattern: /\bmeio[- ]dia\b/, hour: 12, minute: 0 },
    { pattern: /\bdepois do almoco\b/, hour: 14, minute: 0 },
    { pattern: /\b(?:fim|final) da tarde\b/, hour: 18, minute: 0 },
    { pattern: /\bde manha\b/, hour: 9, minute: 0 },
    { pattern: /\ba tarde\b/, hour: 15, minute: 0 },
    { pattern: /\ba noite\b/, hour: 20, minute: 0 }
  ];
  const period = periods.find((item) => item.pattern.test(value));
  if (period) return { hour: period.hour, minute: period.minute };

  const numeric = value.match(/(?:\b(?:as|pelas?)\s+)?\b(\d{1,2})(?::|h)(\d{2})?\b/);
  if (numeric) return normalizeCalendarClock(Number(numeric[1]), Number(numeric[2] || 0), value);

  const prefixedHour = value.match(/\b(?:as|pelas?)\s+(\d{1,2})\b/);
  if (prefixedHour) return normalizeCalendarClock(Number(prefixedHour[1]), 0, value);

  const hourNumber = value.match(/(?:\b(?:as|pelas?)\s+)?\b(\d{1,2})\s+horas?(?:\s+e\s+(\d{1,2})\s+minutos?)?\b/);
  if (hourNumber) return normalizeCalendarClock(Number(hourNumber[1]), Number(hourNumber[2] || 0), value);

  const wordHour = value.match(
    /\b(?:as|pelas?)\s+(uma|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)(?:\s+horas?)?(?:\s+e\s+(meia|quinze|trinta)\s*(?:minutos?)?)?\s*(?:da\s+(manha|tarde|noite))?/
  ) || value.match(
    /\b(uma|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+horas?(?:\s+e\s+(meia|quinze|trinta)\s*(?:minutos?)?)?\s*(?:da\s+(manha|tarde|noite))?/
  ) || value.match(
    /\b(uma|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+da\s+(manha|tarde|noite)\b/
  );
  if (!wordHour) return null;
  const hour = parsePortugueseNumber(wordHour[1]);
  const minuteWord = wordHour.length === 3 ? null : wordHour[2];
  const periodWord = wordHour.length === 3 ? wordHour[2] : wordHour[3];
  const minute = minuteWord === "meia" || minuteWord === "trinta" ? 30 : minuteWord === "quinze" ? 15 : 0;
  return normalizeCalendarClock(hour, minute, periodWord ? `da ${periodWord}` : value);
}

function normalizeCalendarClock(hour, minute, context) {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  if (/\b(?:da|a)\s+tarde\b/.test(context) && hour < 12) hour += 12;
  if (/\b(?:da|a)\s+noite\b/.test(context) && hour < 12) hour += 12;
  if (/\b(?:da|de)\s+manha\b/.test(context) && hour === 12) hour = 0;
  return { hour, minute };
}

function parsePortugueseNumber(value) {
  if (/^\d+$/.test(String(value))) return Number(value);
  const numbers = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4,
    cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    onze: 11, doze: 12
  };
  return numbers[normalizeText(String(value))] ?? null;
}

function extractCalendarReminder(text) {
  const value = normalizeText(text);
  const match = value.match(
    /(?:avise|avisar|lembre|lembrar|notifique|notificar)(?:-me|\s+me)?\s+(?:com\s+)?(\d{1,4})\s*(minutos?|horas?|dias?)\s+antes/
  );
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit.startsWith("dia") ? 1440 : unit.startsWith("hora") ? 60 : 1;
  return Math.min(40320, Math.max(0, amount * multiplier));
}

function formatCalendarReminder(minutes) {
  if (!Number.isFinite(minutes)) return "Lembretes: padrao do Google Agenda.";
  if (minutes % 1440 === 0) return `Lembrete: ${minutes / 1440} dia(s) antes.`;
  if (minutes % 60 === 0) return `Lembrete: ${minutes / 60} hora(s) antes.`;
  return `Lembrete: ${minutes} minuto(s) antes.`;
}

function formatCalendarDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function integrateCalendarEvents(data) {
  if (!Array.isArray(data?.calendarEvents)) return;
  state.calendarEvents = data.calendarEvents
    .map((event) => ({
      id: truncateText(String(event?.id || ""), 180),
      title: truncateText(repairPortugueseText(String(event?.title || "Evento sem titulo")), 180),
      start: String(event?.start || ""),
      end: String(event?.end || "")
    }))
    .filter((event) => event.id && event.start)
    .slice(0, 30);
}

function isReviseEmailDraftCommand(text) {
  const value = normalizeText(text);
  return [
    "altere", "alterar", "mude", "mudar", "troque", "trocar",
    "reescreva", "reescrever", "corrija", "corrigir", "adicione",
    "adicionar", "inclua", "incluir", "remova", "remover", "tire",
    "deixe mais", "faca mais", "mais formal", "mais informal",
    "mais curto", "mais direto", "mais educado", "nao gostei"
  ].some((phrase) => value.includes(phrase));
}

async function revisePendingEmailDraft(instruction) {
  const draft = state.pendingEmailDraft;
  if (!draft) {
    addMessage("assistant", "Chefe, nao ha rascunho pendente para alterar.");
    return;
  }

  showThinking();

  try {
    const requestedSubject = extractRequestedDraftSubject(instruction);
    if (requestedSubject) {
      state.pendingEmailDraft = {
        ...draft,
        to: normalizeKnownEmailDomain(draft.to),
        subject: repairPortugueseText(requestedSubject),
        revisedAt: new Date().toISOString()
      };
      saveState();
      replaceThinking(
        `Assunto alterado, Chefe. Novo assunto: ${requestedSubject}. ` +
        "Mantive o destinatario e o corpo exatamente como estavam. Para enviar, diga: confirmar envio."
      );
      return;
    }

    const response = await fetchWithTimeout("/api/revise-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instruction: truncateText(instruction, limits.messageLength),
        draft: {
          to: draft.to,
          subject: draft.subject,
          message: draft.message
        }
      })
    });

    if (!response.ok) throw new Error(`Revisao respondeu ${response.status}`);
    const data = await response.json();
    if (!data?.subject || !data?.message) throw new Error("revisao vazia");

    const explicitRecipient = extractEmailRecipient(instruction);
    state.pendingEmailDraft = {
      ...draft,
      to: normalizeKnownEmailDomain(explicitRecipient || draft.to),
      subject: truncateText(repairPortugueseText(String(data.subject)), 180),
      message: truncateText(repairPortugueseText(String(data.message)), 1800),
      revisedAt: new Date().toISOString()
    };
    saveState();

    const preview = state.pendingEmailDraft.message.replace(/\s+/g, " ").trim().slice(0, 320);
    replaceThinking(
      `Rascunho alterado, Chefe. Destinatario: ${state.pendingEmailDraft.to}. ` +
      `Assunto: ${state.pendingEmailDraft.subject}. Previa: ${preview}${preview.length === 320 ? "..." : ""} ` +
      "Para enviar, diga: confirmar envio. Para ajustar novamente, diga o que deseja mudar."
    );
  } catch (error) {
    replaceThinking(`Nao consegui alterar o rascunho agora (${error.message}). Mantive a versao anterior.`);
  }
}

function extractRequestedDraftSubject(text) {
  const match = String(text || "").match(
    /(?:troque|mude|altere|corrija|defina)(?:\s+o)?\s+assunto(?:\s+do\s+email)?\s+(?:para|como|por)\s+(.+)$/i
  );
  if (!match?.[1]) return "";
  return truncateText(match[1].replace(/[.!?]+$/g, "").trim(), 180);
}

function repairPortugueseText(text) {
  const replacements = [
    [/Ol(?:Ã¡|¡|¤)/g, "Olá"],
    [/amanh(?:Ã£|á|à|â|ä|å|¤)/gi, "amanhã"],
    [/reuni(?:Ã£|a)o/gi, "reunião"],
    [/vocÃª/gi, "você"],
    [/atenÃ§Ã£o/gi, "atenção"],
    [/informaÃ§(?:Ã£|a)o/gi, "informação"],
    [/informaÃ§Ãµes/gi, "informações"],
    [/confirmaÃ§(?:Ã£|a)o/gi, "confirmação"]
  ];

  let value = String(text || "").normalize("NFC").replace(/\uFFFD/g, "");
  replacements.forEach(([pattern, replacement]) => {
    value = value.replace(pattern, (match) => preserveInitialCase(match, replacement));
  });
  return value;
}

function preserveInitialCase(source, replacement) {
  if (!source) return replacement;
  return source[0] === source[0].toUpperCase()
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;
}

function integrateSuggestedTasks(data) {
  if (!Array.isArray(data?.suggestedTasks) || !data.suggestedTasks.length) return;

  const existing = new Set(state.tasks.map((task) => normalizeText(task)));
  const freshTasks = data.suggestedTasks
    .map((task) => truncateText(String(task || "").trim(), limits.taskLength))
    .filter((task) => task && !existing.has(normalizeText(task)))
    .slice(0, 3);

  if (!freshTasks.length) return;

  state.tasks.unshift(...freshTasks);
  pruneState();
  updateMetrics();
}

function integratePendingDraft(data) {
  const draft = data?.pendingEmailDraft || data?.draft;
  if (!draft?.to || !draft?.message) return;

  state.pendingEmailDraft = {
    to: truncateText(normalizeKnownEmailDomain(String(draft.to)), 160),
    subject: truncateText(repairPortugueseText(String(draft.subject || "Resposta do Jarvis")), 180),
    message: truncateText(repairPortugueseText(String(draft.message)), 1800),
    draftId: truncateText(String(draft.draftId || data.draftId || ""), 120),
    createdAt: new Date().toISOString()
  };
}

async function testWebhookConnection() {
  if (!getWebhookUrl()) {
    state.webhookHealthy = false;
    saveState();
    return "Chefe, ainda nao ha uma URL valida do n8n configurada no painel Cfg, nem um proxy local ativo.";
  }

  try {
    const reply = await askWebhook("Teste de conexao do Jarvis com o n8n. Responda apenas: n8n conectado.");
    return reply
      ? `Chefe, o n8n respondeu: ${reply}`
      : "Chefe, o n8n respondeu sem texto. Confira o node final Responder ao Jarvis.";
  } catch (error) {
    state.webhookHealthy = false;
    saveState();
    return `Chefe, nao consegui falar com o n8n agora. Detalhe: ${error.message}.`;
  }
}

function createLocalReply(text) {
  const lower = normalizeText(text);

  if (lower.includes("tarefa") || lower.includes("crie")) {
    const task = cleanupTask(text);
    state.tasks.unshift(task);
    saveState();
    updateMetrics();
    return toneReply(`Registrado: ${task}. Vou manter isso no radar. Se estiver ligado a estagio, moto ou financas, recomendo definir prazo e primeiro passo.`);
  }

  if (lower.includes("prioridade") || lower.includes("prioridades")) {
    const priorities = inferPriorities();
    state.priorities = priorities;
    saveState();
    updateMetrics();
    return toneReply(`Prioridades sugeridas: ${priorities.join(", ")}. Recomendo atacar a primeira antes de abrir novas frentes.`);
  }

  if (lower.includes("resuma") || lower.includes("resumo")) {
    return summarizeState();
  }

  if (lower.includes("personalidade") || lower.includes("cara mais minha")) {
    return toneReply("Personalidade ativa: sofisticada, educada, competente e levemente espirituosa. Vou te chamar de Chefe, priorizar estagio em TI, moto e organizacao financeira, e aprender seu jeito com o tempo.");
  }

  if (mentionsCareer(lower)) {
    return toneReply("Para o estagio em TI, a rota mais inteligente agora e simples: escolher uma area de entrada, ajustar curriculo e LinkedIn, publicar um projeto pequeno no GitHub e aplicar para vagas toda semana. O primeiro passo e decidir qual area voce quer mirar: suporte, desenvolvimento, dados ou infraestrutura.");
  }

  if (mentionsFinance(lower)) {
    return toneReply("Para estruturar sua vida financeira, eu comecaria pelo mapa real: renda, gastos fixos, dividas, gastos variaveis e meta mensal. Depois disso, a moto deixa de ser vontade solta e vira plano com prazo, entrada e limite de parcela.");
  }

  if (mentionsMotorcycle(lower)) {
    return toneReply("Para comprar a moto sem apertar seu futuro, precisamos comparar preco, seguro, manutencao, combustivel, documento e margem de seguranca. Elegante mesmo e comprar sem transformar liberdade em boleto nervoso.");
  }

  if (mentionsProcrastination(lower)) {
    return toneReply("Vou ser direto: se isso esta ligado ao seu estagio, dinheiro ou moto, adiar custa mais do que parece. Vamos reduzir para uma acao de 15 minutos e executar a primeira parte agora.");
  }

  return toneReply("Entendido. Vou tratar isso como contexto e manter a proxima acao clara: definir objetivo, reduzir ruido e executar o primeiro passo.");
}

async function handleVoiceAction(text) {
  const lower = normalizeText(text);

  if (isDateTimeCommand(lower)) {
    return getDateTimeReply(lower);
  }

  if (isWeatherCommand(lower)) {
    return getWeatherReply(text);
  }

  if (isCreateTaskCommand(lower)) {
    const task = cleanupTask(text);
    state.tasks.unshift(task);
    saveState();
    updateMetrics();
    return `Tarefa criada, Chefe: ${task}.`;
  }

  if (isListTasksCommand(lower)) {
    if (!state.tasks.length) return "Chefe, voce ainda nao tem tarefas registradas.";
    return `Suas tarefas principais: ${state.tasks.slice(0, 5).join("; ")}.`;
  }

  if (isPrioritiesCommand(lower)) {
    const priorities = inferPriorities();
    state.priorities = priorities;
    saveState();
    updateMetrics();
    return `Suas prioridades agora sao: ${priorities.join("; ")}.`;
  }

  if (isDaySummaryCommand(lower)) {
    return summarizeState();
  }

  if (isSaveMemoryCommand(lower)) {
    const markdown = buildObsidianExport();
    const copied = await copyToClipboard(markdown);
    return copied
      ? "Memoria preparada, Chefe. O resumo em Markdown foi copiado para colar no Obsidian."
      : "Nao consegui copiar automaticamente, Chefe. Digite obsidian texto para eu mostrar o resumo na conversa.";
  }

  if (isClearTasksCommand(lower)) {
    state.tasks = [];
    saveState();
    updateMetrics();
    return "Lista de tarefas limpa, Chefe.";
  }

  const externalAction = detectExternalAction(text);
  if (externalAction) {
    return describeExternalAction(externalAction);
  }

  return "";
}

async function getWeatherReply(text) {
  const location = extractWeatherLocation(text) || state.weatherLocation;

  if (!location) {
    return "Chefe, eu consigo ver o clima, mas preciso saber sua cidade primeiro. Diga: minha cidade e Sao Paulo.";
  }

  try {
    const place = await geocodeLocation(location);
    if (!place) return `Chefe, nao encontrei a cidade ${location}. Tente falar cidade e estado.`;

    const weather = await fetchWeather(place);
    return formatWeatherReply(place, weather);
  } catch (error) {
    return `Chefe, encontrei a cidade, mas nao consegui consultar o clima agora. Detalhe: ${error.message || "servico indisponivel"}.`;
  }
}

function detectExternalAction(text) {
  const lower = normalizeText(text);
  const wantsRead = ["ler", "leia", "ver", "veja", "olhar", "olhe", "resumir", "resuma", "procurar", "pesquisar", "consultar", "consulte", "conferir", "confira", "checar", "cheque"].some((word) => lower.includes(word));
  const wantsSend = ["mandar", "mande", "enviar", "envie", "responder", "responda", "preparar", "prepare", "rascunho", "redigir", "redija", "publicar", "publique", "postar", "poste"].some((word) => lower.includes(word));
  const spokenEmail = extractEmailRecipient(text);
  const contact = !spokenEmail && wantsSend ? resolveContactFromRequest(text) : null;
  const recipientEmail = spokenEmail || contact?.email || "";
  const hasEmailAddress = Boolean(recipientEmail);

  if (["agenda", "calendario", "calendar", "compromisso", "eventos"].some((word) => lower.includes(word))) {
    return {
      service: "calendar",
      mode: "read",
      operation: "list_calendar_events",
      query: extractEmailQuery(text),
      start: new Date().toISOString(),
      end: new Date(Date.now() + 7 * 86400000).toISOString(),
      limit: 10,
      requiresConfirmation: false
    };
  }

  if (hasEmailAddress || lower.includes("rascunho") || ["email", "e-mail", "gmail", "outlook", "caixa de entrada"].some((word) => lower.includes(word))) {
    const mode = wantsSend ? "send" : "read";
    return {
      service: "email",
      mode,
      operation: detectEmailOperation(lower, mode),
      query: extractEmailQuery(text),
      to: recipientEmail,
      from: extractEmailSender(text),
      subject: extractEmailSubject(text),
      newer: extractEmailPeriod(lower),
      limit: 8,
      requiresConfirmation: mode === "send"
    };
  }

  if (["whatsapp", "zap", "zapzap"].some((word) => lower.includes(word))) {
    return { service: "whatsapp", mode: wantsSend ? "send" : wantsRead ? "read" : "unknown" };
  }

  if (["instagram", "insta", "direct", "dm"].some((word) => lower.includes(word))) {
    return { service: "instagram", mode: wantsSend || lower.includes("post") ? "send" : wantsRead ? "read" : "unknown" };
  }

  return null;
}

function detectEmailOperation(lower, mode) {
  if (mode === "send") return lower.includes("rascunho") || lower.includes("prepar") ? "draft_email" : "prepare_email";
  if (["urgente", "importante", "prioridade", "prioritarios"].some((word) => lower.includes(word))) return "important_emails";
  if (["vaga", "estagio", "curriculo", "linkedin", "entrevista"].some((word) => lower.includes(word))) return "career_emails";
  if (["procure", "procurar", "pesquise", "pesquisar", "sobre"].some((word) => lower.includes(word))) return "search_emails";
  return "summarize_inbox";
}

function extractEmailQuery(text) {
  const cleaned = sanitizeUserText(text);
  const patterns = [
    /(?:assunto|titulo|título)\s+([^.;?!]+)/i,
    /(?:sobre|por|de)\s+(.+)$/i,
    /(?:procure|procurar|pesquise|pesquisar)\s+(?:emails?|e-mails?|gmail)?\s*(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return truncateText(match[1].replace(/[?.!,;:]+$/g, "").trim(), 160);
  }

  return "";
}

function extractEmailRecipient(text) {
  const cleaned = sanitizeUserText(text);
  const direct = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (direct) return truncateText(normalizeKnownEmailDomain(direct[0]), 160);

  const spoken = normalizeSpokenEmail(cleaned);
  const reconstructed = spoken.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return reconstructed ? truncateText(normalizeKnownEmailDomain(reconstructed[0]), 160) : "";
}

function handleContactCommand(text) {
  const value = sanitizeUserText(text);
  const normalized = normalizeText(value);

  if (["listar contatos", "meus contatos", "quais contatos", "mostrar contatos"].some((phrase) => normalized.includes(phrase))) {
    if (!state.contacts.length) return "Chefe, voce ainda nao tem contatos salvos.";
    const contacts = state.contacts.slice(0, 12).map((contact) => {
      const channels = [contact.email, contact.phone ? formatPhoneForDisplay(contact.phone) : ""].filter(Boolean);
      return `${contact.name}: ${channels.join(", ")}`;
    });
    return `Contatos salvos: ${contacts.join("; ")}.`;
  }

  const removeMatch = value.match(/(?:apague|apagar|remova|remover|esqueca|esqueça)(?:\s+o)?\s+contato(?:\s+do|\s+da|\s+de)?\s+(.+)$/i);
  if (removeMatch?.[1]) {
    const key = normalizeContactName(removeMatch[1]);
    const index = state.contacts.findIndex((contact) => normalizeContactName(contact.name) === key);
    if (index < 0) return `Chefe, nao encontrei o contato ${removeMatch[1].trim()}.`;
    const [removed] = state.contacts.splice(index, 1);
    saveState();
    return `Contato removido, Chefe: ${removed.name}.`;
  }

  const isSaveCommand = [
    "salve o email", "salve o e-mail", "salvar o email", "salvar o e-mail",
    "guarde o email", "guarde o e-mail", "registre o email", "registre o e-mail",
    "atualize o email", "atualize o e-mail", "mude o email", "mude o e-mail",
    "adicione o contato", "adicionar contato", "salve o contato", "atualize o contato"
  ].some((phrase) => normalized.includes(phrase));
  const isPhoneSaveCommand = [
    "salve o whatsapp", "salvar o whatsapp", "guarde o whatsapp",
    "registre o whatsapp", "atualize o whatsapp", "salve o telefone",
    "salvar o telefone", "atualize o telefone"
  ].some((phrase) => normalized.includes(phrase));
  if (!isSaveCommand && !isPhoneSaveCommand) return "";

  const email = extractEmailRecipient(value);
  const phone = extractWhatsAppPhone(value);
  const name = extractContactNameFromSaveCommand(value);
  if (!email && !phone) return "Chefe, nao consegui identificar o email ou telefone com DDD.";
  if (!name) return "Chefe, entendi o contato, mas preciso do nome.";

  const key = normalizeContactName(name);
  const existing = state.contacts.find((contact) => normalizeContactName(contact.name) === key);
  if (existing) {
    existing.name = name;
    if (email) existing.email = email;
    if (phone) existing.phone = phone;
    existing.updatedAt = new Date().toISOString();
  } else {
    state.contacts.unshift({ name, email, phone, updatedAt: new Date().toISOString() });
  }
  saveState();
  return `Contato salvo, Chefe: ${name}, ${email || formatPhoneForDisplay(phone)}.`;
}

function extractContactNameFromSaveCommand(text) {
  const match = String(text || "").match(
    /(?:whatsapp|telefone)\s+(?:do|da|de)\s+(.+?)\s+(?:como|sendo|e)\s+/i
  ) || String(text || "").match(
    /(?:email|e-mail|contato)\s+(?:do|da|de)\s+(.+?)\s+(?:como|sendo|é|e)\s+/i
  );
  if (!match?.[1]) return "";
  return formatContactName(match[1]);
}

function resolveContactFromRequest(text) {
  const match = String(text || "").match(
    /(?:para|pro|pra)\s+(?:o|a)?\s*([^,.;?!]+?)(?=\s+(?:sobre|com|dizendo|avisando|agradecendo|pedindo|assunto)\b|$)/i
  );
  if (!match?.[1]) return null;
  const requested = normalizeContactName(match[1]);
  if (!requested || requested.includes("@")) return null;
  return state.contacts.find((contact) => normalizeContactName(contact.name) === requested) || null;
}

function normalizeContactName(name) {
  return normalizeText(String(name || ""))
    .replace(/\b(?:o contato|a contato)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatContactName(name) {
  return String(name || "")
    .replace(/[.,;:!?]+$/g, "")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    .slice(0, 80);
}

function normalizeKnownEmailDomain(email) {
  return String(email || "")
    .toLowerCase()
    .replace(/@icloud\.com\.br$/i, "@icloud.com")
    .replace(/@gmail\.com\.br$/i, "@gmail.com")
    .replace(/@hotmail\.com\.br$/i, "@hotmail.com")
    .replace(/@outlook\.com\.br$/i, "@outlook.com");
}

function normalizeSpokenEmail(text) {
  let value = normalizeText(correctEmailPhonetics(correctVoiceTranscript(text)))
    .replace(/\b(?:arroba|a rouba|a roupa|aroba)\b/g, "@")
    .replace(/\b(?:ponto|pontos|dot)\b/g, ".")
    .replace(/\b(?:underline|under line|sublinhado|underscore)\b/g, "_")
    .replace(/\b(?:hifen|traco|traco medio)\b/g, "-");

  const recipientPart = value.match(/(?:para|pro|pra|destinatario|destinatário)\s+(.+?)(?=\s+(?:sobre|assunto|dizendo|avisando|agradecendo|pedindo)\b|$)/i)?.[1];
  if (recipientPart) value = recipientPart;

  return value
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*_\s*/g, "_")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "");
}

function extractEmailSender(text) {
  const cleaned = sanitizeUserText(text);
  const match = cleaned.match(/(?:do|da|de|remetente)\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|[^.;?!]+)/i);
  if (!match?.[1]) return "";
  const value = match[1].replace(/\b(sobre|assunto|nos ultimos|nos últimos)\b.*$/i, "").trim();
  return truncateText(value, 160);
}

function extractEmailSubject(text) {
  const match = sanitizeUserText(text).match(/(?:assunto|titulo|título)\s+([^.;?!]+)/i);
  return match?.[1] ? truncateText(match[1].trim(), 160) : "";
}

function extractEmailPeriod(lower) {
  const days = lower.match(/(?:ultimos|últimos|últimas|ultimas)\s+(\d{1,3})\s+dias?/);
  if (days?.[1]) return `${Math.min(120, Math.max(1, Number(days[1])))}d`;
  if (lower.includes("hoje")) return "1d";
  if (lower.includes("semana")) return "7d";
  if (lower.includes("mes") || lower.includes("mês")) return "30d";
  return "";
}

function isWeatherCommand(text) {
  return [
    "clima",
    "tempo hoje",
    "temperatura",
    "vai chover",
    "previsao do tempo",
    "previsao para hoje",
    "como esta o tempo"
  ].some((phrase) => text.includes(phrase));
}

function isDateTimeCommand(text) {
  return [
    "que dia e hoje",
    "qual a data de hoje",
    "data de hoje",
    "qual dia estamos",
    "em que dia estamos",
    "que horas sao",
    "qual a hora",
    "horario agora",
    "hora agora",
    "dia da semana"
  ].some((phrase) => text.includes(phrase));
}

function getDateTimeReply(text) {
  const now = new Date();
  const wantsOnlyTime = ["que horas", "qual a hora", "horario agora", "hora agora"].some((phrase) => text.includes(phrase));
  const wantsOnlyDate = ["que dia", "qual a data", "data de hoje", "qual dia", "em que dia", "dia da semana"].some((phrase) => text.includes(phrase));
  const date = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(now);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);

  if (wantsOnlyTime && !wantsOnlyDate) return `Chefe, agora sao ${time}.`;
  if (wantsOnlyDate && !wantsOnlyTime) return `Chefe, hoje e ${date}.`;
  return `Chefe, hoje e ${date}, e agora sao ${time}.`;
}

function isSetWeatherLocationCommand(text) {
  return [
    "minha cidade e",
    "minha cidade eh",
    "minha cidade é",
    "cidade padrao e",
    "cidade padrao eh",
    "cidade padrão é",
    "moro em"
  ].some((phrase) => normalizeText(text).includes(normalizeText(phrase)));
}

function extractWeatherLocation(text) {
  const cleaned = text.trim();
  const locationFromWeatherPhrase = extractLocationFromWeatherPhrase(cleaned);
  if (locationFromWeatherPhrase) return locationFromWeatherPhrase;

  const patterns = [
    /(?:minha cidade (?:e|eh|é)|cidade padr(?:a|ã)o (?:e|eh|é)|moro em)\s+(.+)/i,
    /(?:clima|tempo|temperatura|previs(?:a|ã)o)(?:\s+(?:em|de|para|na|no))\s+(.+)/i,
    /vai chover(?:\s+(?:em|na|no))\s+(.+)/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return sanitizeLocation(match[1]);
  }

  return "";
}

function extractLocationFromWeatherPhrase(text) {
  const normalized = normalizeText(text);
  const weatherIndex = ["clima", "tempo", "temperatura", "previsao", "vai chover"]
    .map((word) => normalized.indexOf(word))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (weatherIndex === undefined) return "";

  const connectors = [
    " em ",
    " para ",
    " na ",
    " no ",
    " de hoje em ",
    " hoje em ",
    " hoje para "
  ];
  const tail = text.slice(weatherIndex);
  const normalizedTail = normalizeText(tail);

  for (const connector of connectors) {
    const index = normalizedTail.lastIndexOf(connector);
    if (index >= 0) {
      return sanitizeLocation(tail.slice(index + connector.length));
    }
  }

  return "";
}

function sanitizeLocation(location) {
  return location
    .replace(/[?.!,;:]+$/g, "")
    .replace(/^(?:hoje|agora|amanha|amanhÃ£)\s+(?:em|de|para|na|no)\s+/i, "")
    .replace(/^(?:em|de|para|na|no)\s+/i, "")
    .replace(/^cidade\s+(?:de|da|do)\s+/i, "")
    .replace(/\b(hoje|agora|amanha|amanhã)$/i, "")
    .trim()
    .slice(0, limits.locationLength);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), limits.requestTimeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function getSafeHttpUrl(value, { allowLocalhost = false } = {}) {
  if (!value) return "";

  try {
    const url = new URL(value);
    const safeHttp = url.protocol === "https:" || (allowLocalhost && url.protocol === "http:" && isLocalHost(url.hostname));
    return safeHttp ? url.toString() : "";
  } catch {
    return "";
  }
}

function getWebhookUrl() {
  const configuredUrl = getSafeHttpUrl(state.webhookUrl, { allowLocalhost: true });
  if (configuredUrl) return configuredUrl;
  if (isLocalHost(window.location.hostname) && window.location.protocol === "http:") return "/api/jarvis";
  return "";
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isSafeAudioSource(source) {
  if (source.startsWith("data:audio/")) return true;
  return Boolean(source.startsWith("blob:") || getSafeHttpUrl(source, { allowLocalhost: true }));
}

function sanitizeUserText(text) {
  return truncateText(String(text || "").replace(/\s+/g, " ").trim(), limits.messageLength);
}

function truncateText(text, maxLength) {
  const value = String(text || "");
  return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
}

function normalizeList(list, maxItems, maxLength) {
  return [...new Set((Array.isArray(list) ? list : [])
    .map((item) => truncateText(String(item || "").replace(/\s+/g, " ").trim(), maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

function pruneState() {
  state.messages = (Array.isArray(state.messages) ? state.messages : defaults.messages)
    .map((message) => ({
      role: message?.role === "user" ? "user" : "assistant",
      text: truncateText(message?.text || "", limits.replyLength),
      pending: Boolean(message?.pending)
    }))
    .filter((message) => message.text)
    .slice(-limits.maxMessages);
  state.tasks = normalizeList(state.tasks, limits.maxTasks, limits.taskLength);
  state.priorities = normalizeList(state.priorities, limits.maxPriorities, limits.taskLength);
  state.contacts = (Array.isArray(state.contacts) ? state.contacts : [])
    .map((contact) => ({
      name: formatContactName(contact?.name),
      email: normalizeKnownEmailDomain(contact?.email),
      phone: normalizeWhatsAppPhone(contact?.phone),
      updatedAt: String(contact?.updatedAt || "")
    }))
    .filter((contact) => contact.name && (
      /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(contact.email) || Boolean(contact.phone)
    ))
    .slice(0, limits.maxContacts);
  state.calendarEvents = (Array.isArray(state.calendarEvents) ? state.calendarEvents : []).slice(0, 30);
  state.weatherLocation = truncateText(state.weatherLocation || "", limits.locationLength);
}

async function geocodeLocation(location) {
  location = sanitizeLocation(location);
  if (!location) return null;

  const knownPlace = getKnownPlace(location);
  if (knownPlace) return knownPlace;

  const candidates = buildLocationCandidates(location);
  for (const candidate of candidates) {
    const place = await geocodeLocationCandidate(candidate);
    if (place) return place;
  }

  return null;
}

async function geocodeLocationCandidate(location) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", location);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "pt");
  url.searchParams.set("format", "json");

  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error("geocoding failed");

  const data = await response.json();
  return data.results?.[0] || null;
}

function buildLocationCandidates(location) {
  const clean = sanitizeLocation(location);
  const withoutState = clean.split(",")[0].trim();
  const withoutDuplicatedState = clean.replace(/\s*,?\s*(sao paulo|são paulo)$/i, "").trim();

  return [...new Set([
    clean,
    withoutState,
    withoutDuplicatedState,
    normalizeText(clean),
    normalizeText(withoutState),
    normalizeText(withoutDuplicatedState)
  ].filter(Boolean))];
}

function getKnownPlace(location) {
  const key = normalizeText(location)
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const knownPlaces = {
    "sao paulo": {
      name: "São Paulo",
      admin1: "São Paulo",
      country: "Brasil",
      latitude: -23.5475,
      longitude: -46.6361
    },
    "sao paulo sao paulo": {
      name: "São Paulo",
      admin1: "São Paulo",
      country: "Brasil",
      latitude: -23.5475,
      longitude: -46.6361
    },
    "osasco": {
      name: "Osasco",
      admin1: "São Paulo",
      country: "Brasil",
      latitude: -23.5325,
      longitude: -46.7917
    },
    "osasco sao paulo": {
      name: "Osasco",
      admin1: "São Paulo",
      country: "Brasil",
      latitude: -23.5325,
      longitude: -46.7917
    }
  };

  return knownPlaces[key] || null;
}

async function fetchWeather(place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", place.latitude);
  url.searchParams.set("longitude", place.longitude);
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "precipitation_probability_max,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error("weather failed");

  return response.json();
}

function formatWeatherReply(place, weather) {
  const current = weather.current || {};
  const daily = weather.daily || {};
  const city = [place.name, place.admin1].filter(Boolean).join(", ");
  const temp = Math.round(current.temperature_2m);
  const min = Math.round(daily.temperature_2m_min?.[0]);
  const max = Math.round(daily.temperature_2m_max?.[0]);
  const rainChance = daily.precipitation_probability_max?.[0];
  const condition = weatherDescription(current.weather_code);
  const rain = Number(current.precipitation || 0) > 0 ? "esta chovendo agora" : `chance maxima de chuva hoje: ${rainChance ?? 0}%`;

  state.weatherLocation = city;
  saveState();

  return `Chefe, em ${city} agora esta ${temp} graus, ${condition}. Hoje fica entre ${min} e ${max} graus, e ${rain}.`;
}

function weatherDescription(code) {
  const descriptions = {
    0: "ceu limpo",
    1: "principalmente limpo",
    2: "parcialmente nublado",
    3: "nublado",
    45: "com neblina",
    48: "com neblina congelante",
    51: "com garoa fraca",
    53: "com garoa moderada",
    55: "com garoa forte",
    61: "com chuva fraca",
    63: "com chuva moderada",
    65: "com chuva forte",
    80: "com pancadas de chuva fracas",
    81: "com pancadas de chuva",
    82: "com pancadas fortes de chuva",
    95: "com trovoadas"
  };

  return descriptions[code] || "com condicao indefinida";
}

function describeExternalAction(action) {
  const names = {
    email: "email",
    whatsapp: "WhatsApp",
    instagram: "Instagram"
  };
  const serviceName = names[action.service] || action.service;
  const configured = state.integrations?.[action.service] === "configured";

  if (action.service === "email") {
    return "";
  }

  if (action.mode === "send" && state.permissions?.requireConfirmation) {
    return `Chefe, posso preparar a mensagem no ${serviceName}, mas preciso da sua confirmacao antes de enviar.`;
  }

  if (!configured) {
    return `Chefe, eu entendi o pedido para ${serviceName}, mas essa conta ainda nao esta conectada no n8n. Posso preparar isso com permissao de leitura primeiro e envio sempre com confirmacao.`;
  }

  return `Chefe, vou consultar o ${serviceName} e te responder com um resumo objetivo.`;
}

function isConfirmEmailSendCommand(text) {
  const lower = normalizeText(text);
  return [
    "confirmar envio",
    "confirma envio",
    "pode enviar",
    "envia esse email",
    "envie esse email",
    "manda esse email",
    "mande esse email",
    "enviar rascunho",
    "envie o rascunho"
  ].some((phrase) => lower.includes(phrase));
}

function isCancelEmailSendCommand(text) {
  const lower = normalizeText(text);
  return [
    "cancelar envio",
    "cancela envio",
    "nao enviar",
    "não enviar",
    "cancelar rascunho",
    "cancela o rascunho"
  ].some((phrase) => lower.includes(phrase));
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mentionsCareer(text) {
  return ["estagio", "ti", "curriculo", "linkedin", "github", "vaga", "entrevista", "portfolio", "programacao"].some((word) => text.includes(word));
}

function mentionsFinance(text) {
  return ["dinheiro", "financeiro", "financas", "gasto", "gastos", "economizar", "guardar", "orcamento", "divida", "parcela"].some((word) => text.includes(word));
}

function mentionsMotorcycle(text) {
  return ["moto", "motocicleta", "cnh", "seguro", "capacete"].some((word) => text.includes(word));
}

function mentionsProcrastination(text) {
  return ["depois", "amanha", "procrastin", "sem vontade", "preguica", "enrolando"].some((word) => text.includes(word));
}

function isCreateTaskCommand(text) {
  return [
    "crie uma tarefa",
    "criar tarefa",
    "nova tarefa",
    "adicione uma tarefa",
    "adicionar tarefa",
    "anote uma tarefa",
    "registrar tarefa",
    "registre uma tarefa"
  ].some((phrase) => text.includes(phrase));
}

function isListTasksCommand(text) {
  return [
    "listar tarefas",
    "liste minhas tarefas",
    "quais minhas tarefas",
    "minhas tarefas",
    "tarefas de hoje",
    "o que tenho para fazer"
  ].some((phrase) => text.includes(phrase));
}

function isPrioritiesCommand(text) {
  return [
    "quais minhas prioridades",
    "minhas prioridades",
    "organize minhas prioridades",
    "prioridades de hoje",
    "o que e prioridade",
    "o que eu devo fazer primeiro"
  ].some((phrase) => text.includes(phrase));
}

function isDaySummaryCommand(text) {
  return [
    "resuma meu dia",
    "resumo do dia",
    "resuma o estado",
    "resuma meu estado",
    "como estamos",
    "onde paramos"
  ].some((phrase) => text.includes(phrase));
}

function isSaveMemoryCommand(text) {
  return [
    "salve isso na memoria",
    "salvar na memoria",
    "guarde isso",
    "registre na memoria",
    "salve no obsidian",
    "mandar para o obsidian",
    "exportar para obsidian"
  ].some((phrase) => text.includes(phrase));
}

function isClearTasksCommand(text) {
  return [
    "limpar tarefas",
    "apague minhas tarefas",
    "zerar tarefas",
    "limpe a lista de tarefas"
  ].some((phrase) => text.includes(phrase));
}

function cleanupTask(text) {
  const task = text
    .replace(/^jarvis[, ]*/gi, "")
    .replace(/\b(?:me|mim)\b/gi, "")
    .replace(/crie uma tarefa para/gi, "")
    .replace(/criar uma tarefa para/gi, "")
    .replace(/crie uma tarefa/gi, "")
    .replace(/criar tarefa/gi, "")
    .replace(/nova tarefa/gi, "")
    .replace(/adicione uma tarefa/gi, "")
    .replace(/adicionar tarefa/gi, "")
    .replace(/anote uma tarefa/gi, "")
    .replace(/registrar tarefa/gi, "")
    .replace(/registre uma tarefa/gi, "")
    .replace(/tarefa/gi, "")
    .trim()
    .replace(/^./, (char) => char.toUpperCase()) || "Revisar proxima acao";

  return truncateText(task, limits.taskLength);
}

function inferPriorities() {
  const base = state.tasks.slice(0, 3);
  if (base.length) return base;
  return personalityProfile.priorities;
}

function summarizeState() {
  const tasks = state.tasks.length ? state.tasks.slice(0, 3).join(", ") : "nenhuma tarefa registrada";
  const priorities = state.priorities.length ? state.priorities.join(", ") : "prioridades ainda nao definidas";
  return toneReply(`Estado atual: ${tasks}. Prioridades: ${priorities}. Modo: ${state.webhookUrl ? "n8n conectado" : "local"}. Foco principal: estagio em TI, moto e organizacao financeira.`);
}

function toneReply(text) {
  const addressed = text.startsWith("Chefe") ? text : `Chefe, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  if (state.tone === "direto") return `${addressed.split(".")[0]}.`;
  if (state.tone === "estrategico") return `${addressed} Posso separar isso em decisao, execucao e acompanhamento.`;
  return addressed;
}

function buildSystemPrompt() {
  return [
    "Voce e Jarvis, assistente pessoal em portugues do Brasil.",
    "Chame o usuario de Chefe.",
    "A conversa acontece principalmente por voz.",
    "Responda como um assistente de voz real: frases curtas, naturais e acionaveis.",
    "Quando executar ou registrar algo, confirme em uma frase curta.",
    "Quando faltar uma informacao critica, pergunte apenas uma coisa por vez.",
    "Nao assuma casa inteligente, luzes, temperatura, musica ou dispositivos IoT configurados.",
    "Para clima e previsao do tempo, use dados reais quando a ferramenta estiver disponivel. Se nao houver cidade definida, pergunte a cidade.",
    "Para email, WhatsApp e Instagram, nunca finja acesso. Se a integracao nao estiver configurada, diga isso.",
    "Para enviar mensagens, responder pessoas, publicar conteudo ou apagar dados, sempre peca confirmacao antes.",
    "Seu tom e sofisticado, educado, extremamente competente, calmo e levemente espirituoso.",
    "Prioridades do usuario: conseguir estagio em TI, comprar uma moto e estruturar melhor a vida financeira.",
    "Responda com precisao. Avise quando nao tiver certeza. Nao invente dados.",
    "Quando houver procrastinacao, cobre com firmeza elegante.",
    "Quando houver decisao de carreira ou dinheiro, aponte riscos e proponha proximos passos claros."
  ].join("\n");
}

function buildObsidianExport() {
  const now = new Date().toLocaleString("pt-BR");
  const tasks = state.tasks.length ? state.tasks.map((task) => `- [ ] ${task}`).join("\n") : "- Nenhuma tarefa registrada.";
  const priorities = inferPriorities().map((priority) => `- ${priority}`).join("\n");
  const recentMessages = state.messages
    .slice(-8)
    .map((message) => `- **${message.role === "assistant" ? state.assistantName || "Jarvis" : state.userName || "Chefe"}:** ${message.text}`)
    .join("\n");

  return [
    "# Registro do Jarvis",
    "",
    `Data: ${now}`,
    "",
    "## Perfil ativo",
    "",
    `- Assistente: ${state.assistantName || "Jarvis"}`,
    `- Usuario: ${state.userName || "Chefe"}`,
    `- Tom: ${state.tone || "estrategico"}`,
    "",
    "## Prioridades",
    "",
    priorities,
    "",
    "## Tarefas",
    "",
    tasks,
    "",
    "## Mensagens recentes",
    "",
    recentMessages || "- Nenhuma mensagem recente.",
    "",
    "## Aprendizados possiveis",
    "",
    "- "
  ].join("\n");
}

function showThinking() {
  state.messages.push({ role: "assistant", text: "Analisando...", pending: true });
  render();
}

function replaceThinking(text) {
  const pending = state.messages.findLastIndex((message) => message.pending);
  const safeText = truncateText(text, limits.replyLength);
  if (pending >= 0) state.messages[pending] = { role: "assistant", text: safeText };
  else state.messages.push({ role: "assistant", text: safeText });
  saveState();
  render();
  speak(safeText);
}

function addMessage(role, text) {
  const maxLength = role === "user" ? limits.messageLength : limits.replyLength;
  state.messages.push({ role, text: truncateText(text, maxLength) });
  saveState();
  render();
}

function render() {
  els.conversation.innerHTML = "";
  state.messages.slice(-12).forEach((message) => {
    const item = document.createElement("div");
    item.className = `message ${message.role}`;

    const label = document.createElement("span");
    label.textContent = message.role === "assistant" ? state.assistantName || "Jarvis" : state.userName || "Voce";

    const paragraph = document.createElement("p");
    paragraph.textContent = message.text;

    item.append(label, paragraph);
    els.conversation.append(item);
  });

  els.conversation.scrollTop = els.conversation.scrollHeight;
  updateMetrics();
  hydrateSettings();
  updateVoiceControls();
  renderOperations();
}

function selectOperationsTab(tab) {
  document.querySelectorAll("[data-operations-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.operationsTab === tab);
  });
  document.querySelectorAll("[data-operations-view]").forEach((view) => {
    view.classList.toggle("active", view.dataset.operationsView === tab);
  });
}

function renderOperations() {
  if (!els.contactsList || !els.pendingList) return;
  renderContactsPanel();
  renderPendingPanel();
}

function renderContactsPanel() {
  els.contactsList.innerHTML = "";
  els.contactsBadge.textContent = String(state.contacts.length);

  if (!state.contacts.length) {
    els.contactsList.append(createOperationsEmpty("Nenhum contato salvo."));
    return;
  }

  state.contacts.forEach((contact) => {
    const item = document.createElement("article");
    item.className = "operation-item";

    const content = document.createElement("div");
    content.className = "operation-content";
    const title = document.createElement("strong");
    title.textContent = contact.name;
    const detail = document.createElement("span");
    detail.textContent = [
      contact.email,
      contact.phone ? `WhatsApp: ${formatPhoneForDisplay(contact.phone)}` : ""
    ].filter(Boolean).join(" | ");
    content.append(title, detail);

    const actions = document.createElement("div");
    actions.className = "operation-actions";
    actions.append(
      createPanelButton("Editar", "edit", "contact", normalizeContactName(contact.name)),
      createPanelButton("Excluir", "delete", "contact", normalizeContactName(contact.name), "danger")
    );

    item.append(content, actions);
    els.contactsList.append(item);
  });
}

function renderPendingPanel() {
  els.pendingList.innerHTML = "";
  const pendingItems = [];

  if (state.pendingEmailDraft) {
    pendingItems.push({
      type: "Email",
      title: state.pendingEmailDraft.subject || "Sem assunto",
      detail: `Para: ${state.pendingEmailDraft.to}`,
      confirm: "confirm-email",
      cancel: "cancel-email"
    });
  }

  if (state.pendingWhatsAppMessage) {
    pendingItems.push({
      type: "WhatsApp",
      title: state.pendingWhatsAppMessage.contactName || formatPhoneForDisplay(state.pendingWhatsAppMessage.to),
      detail: state.pendingWhatsAppMessage.message,
      confirm: "confirm-whatsapp",
      cancel: "cancel-whatsapp"
    });
  }

  if (state.pendingCalendarEvent) {
    pendingItems.push({
      type: "Novo evento",
      title: state.pendingCalendarEvent.title,
      detail: formatCalendarDate(state.pendingCalendarEvent.start),
      confirm: "confirm-event",
      cancel: "cancel-event"
    });
  }

  if (state.pendingCalendarAction) {
    const deleting = state.pendingCalendarAction.type === "delete";
    pendingItems.push({
      type: deleting ? "Excluir evento" : "Alterar evento",
      title: state.pendingCalendarAction.event?.title || "Compromisso",
      detail: deleting
        ? formatCalendarDate(state.pendingCalendarAction.event?.start)
        : `Novo horario: ${formatCalendarDate(state.pendingCalendarAction.changes?.start)}`,
      confirm: "confirm-calendar-change",
      cancel: "cancel-calendar-change"
    });
  }

  if (state.pendingCalendarRequest) {
    pendingItems.push({
      type: "Horario necessario",
      title: "Evento incompleto",
      detail: state.pendingCalendarRequest,
      cancel: "cancel-calendar-request"
    });
  }

  els.pendingBadge.textContent = String(pendingItems.length);
  if (!pendingItems.length) {
    els.pendingList.append(createOperationsEmpty("Nenhuma acao aguardando confirmacao."));
    return;
  }

  pendingItems.forEach((pending) => {
    const item = document.createElement("article");
    item.className = "operation-item pending-item";

    const content = document.createElement("div");
    content.className = "operation-content";
    const type = document.createElement("small");
    type.textContent = pending.type;
    const title = document.createElement("strong");
    title.textContent = pending.title;
    const detail = document.createElement("span");
    detail.textContent = pending.detail;
    content.append(type, title, detail);

    const actions = document.createElement("div");
    actions.className = "operation-actions";
    if (pending.confirm) actions.append(createPanelButton("Confirmar", pending.confirm, "pending"));
    actions.append(createPanelButton("Cancelar", pending.cancel, "pending", "", "danger"));

    item.append(content, actions);
    els.pendingList.append(item);
  });
}

function createOperationsEmpty(text) {
  const empty = document.createElement("p");
  empty.className = "operations-empty";
  empty.textContent = text;
  return empty;
}

function createPanelButton(label, action, group, key = "", variant = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (variant) button.className = variant;
  if (group === "contact") {
    button.dataset.contactAction = action;
    button.dataset.contactKey = key;
  } else {
    button.dataset.pendingAction = action;
  }
  return button;
}

function saveContactFromPanel() {
  const name = formatContactName(els.contactName.value);
  const email = normalizeKnownEmailDomain(els.contactEmail.value.trim());
  const phone = normalizeWhatsAppPhone(els.contactPhone.value);
  const validEmail = !email || /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
  if (!name || !validEmail || (!email && !phone)) {
    addMessage("assistant", "Chefe, informe um nome e pelo menos um email valido ou WhatsApp com DDD.");
    return;
  }

  const editKey = els.contactEditKey.value;
  const existing = editKey
    ? state.contacts.find((contact) => normalizeContactName(contact.name) === editKey)
    : state.contacts.find((contact) => normalizeContactName(contact.name) === normalizeContactName(name));

  if (existing) {
    existing.name = name;
    existing.email = email;
    existing.phone = phone;
    existing.updatedAt = new Date().toISOString();
  } else {
    state.contacts.unshift({ name, email, phone, updatedAt: new Date().toISOString() });
  }
  pruneState();
  saveState();
  resetContactForm();
  addMessage("assistant", `Contato salvo, Chefe: ${name}.`);
}

function beginContactEdit(key) {
  const contact = state.contacts.find((item) => normalizeContactName(item.name) === key);
  if (!contact) return;
  els.contactName.value = contact.name;
  els.contactEmail.value = contact.email;
  els.contactPhone.value = contact.phone ? formatPhoneForDisplay(contact.phone) : "";
  els.contactEditKey.value = key;
  els.cancelContactEdit.hidden = false;
  els.contactName.focus();
}

function deleteContactFromPanel(key) {
  const index = state.contacts.findIndex((contact) => normalizeContactName(contact.name) === key);
  if (index < 0) return;
  const [removed] = state.contacts.splice(index, 1);
  saveState();
  resetContactForm();
  addMessage("assistant", `Contato removido, Chefe: ${removed.name}.`);
}

function resetContactForm() {
  els.contactForm.reset();
  els.contactEditKey.value = "";
  els.cancelContactEdit.hidden = true;
}

async function handlePendingPanelAction(action) {
  if (action === "confirm-whatsapp") return confirmPendingWhatsAppSend();
  if (action === "cancel-whatsapp") return cancelPendingWhatsAppSend();
  if (action === "confirm-email") return confirmPendingEmailSend();
  if (action === "cancel-email") return cancelPendingEmailSend();
  if (action === "confirm-event") return confirmPendingCalendarEvent();
  if (action === "cancel-event") return cancelPendingCalendarEvent();
  if (action === "confirm-calendar-change") return confirmPendingCalendarChange();
  if (action === "cancel-calendar-change") return cancelPendingCalendarChange();
  if (action === "cancel-calendar-request") {
    state.pendingCalendarRequest = "";
    saveState();
    addMessage("assistant", "Preparacao do evento cancelada, Chefe.");
  }
}

function updateMetrics() {
  els.taskCount.textContent = `${String(state.tasks.length).padStart(2, "0")} TASKS`;
  els.priorityCount.textContent = String(state.priorities.length).padStart(2, "0");
  els.contextScore.textContent = `${Math.min(99, 82 + state.messages.length + state.tasks.length)}%`;
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    els.connectionStatus.textContent = "LOCAL";
  } else if (webhookUrl === "/api/jarvis") {
    els.connectionStatus.textContent = state.webhookHealthy ? "N8N OK" : "N8N PROXY";
  } else {
    els.connectionStatus.textContent = state.webhookHealthy ? "N8N OK" : "N8N CFG";
  }
  els.assistantTitle.textContent = state.assistantName || "JARVIS";
}

function hydrateSettings() {
  els.voiceProvider.value = state.voiceProvider || "browser";
  els.voiceName.value = state.voiceName || "auto";
  els.voiceRate.value = state.voiceRate || "0.82";
  els.voicePitch.value = state.voicePitch || "0.72";
  els.ttsWebhookUrl.value = state.ttsWebhookUrl || "";
  els.webhookUrl.value = state.webhookUrl || "";
  els.webhookToken.value = state.webhookToken || "";
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognition) {
    setVoiceStatus("Voz indisponivel neste navegador. Use Chrome ou Edge para falar.");
    return;
  }

  recognition = new Recognition();
  recognition.lang = "pt-BR";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.addEventListener("start", () => {
    isListening = true;
    voiceTranscript = "";
    voiceSubmitting = false;
    clearTimeout(voiceSubmitTimer);
    updateVoiceControls();
    setVoiceStatus("Microfone ativo. Fale agora, Chefe.");
  });

  recognition.addEventListener("audiostart", () => {
    setVoiceStatus("Audio detectado. Continue falando.");
  });

  recognition.addEventListener("soundstart", () => {
    setVoiceStatus("Som detectado. Estou tentando entender.");
  });

  recognition.addEventListener("speechstart", () => {
    setVoiceStatus("Fala detectada. Processando sua voz.");
  });

  recognition.addEventListener("nomatch", () => {
    setVoiceStatus("Ouvi algo, mas nao consegui transformar em texto. Tente falar mais perto do microfone.");
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    updateVoiceControls();
    if (voiceTranscript && !voiceSubmitting) {
      submitVoiceTranscript();
      return;
    }
    if (!els.input.value.trim() && !voiceSubmitting) {
      setVoiceStatus(shouldKeepListening ? "Pausado. Vou voltar a ouvir apos responder." : "Voz pronta. Clique em Mic e fale.");
    }
  });

  recognition.addEventListener("error", (event) => {
    clearTimeout(voiceSubmitTimer);
    isListening = false;
    updateVoiceControls();
    setVoiceStatus(describeVoiceError(event.error));
  });

  recognition.addEventListener("result", (event) => {
    clearTimeout(voiceSubmitTimer);
    voiceTranscript = Array.from(event.results)
      .map(selectRecognitionAlternative)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    els.input.value = voiceTranscript;
    const lastResult = event.results[event.results.length - 1];
    if (lastResult.isFinal && voiceTranscript) {
      setVoiceStatus("Entendi. Aguarde um instante ou continue falando.");
      voiceSubmitTimer = setTimeout(submitVoiceTranscript, 1100);
    }
  });

  setVoiceStatus("Voz pronta. Clique no nucleo JARVIS e fale.");
}

function selectRecognitionAlternative(result) {
  const alternatives = Array.from(result || []);
  if (!alternatives.length) return "";

  const commandWords = [
    "jarvis", "email", "gmail", "rascunho", "enviar", "confirmar",
    "cancelar", "arroba", "ponto", "clima", "tempo", "tarefa"
  ];

  return alternatives
    .map((alternative, index) => {
      const transcript = String(alternative.transcript || "").trim();
      const normalized = normalizeText(transcript);
      const commandScore = commandWords.filter((word) => normalized.includes(word)).length * 0.08;
      const confidence = Number.isFinite(alternative.confidence) ? alternative.confidence : 0;
      return { transcript, score: confidence + commandScore - index * 0.01 };
    })
    .sort((a, b) => b.score - a.score)[0]?.transcript || "";
}

async function submitVoiceTranscript() {
  clearTimeout(voiceSubmitTimer);
  const transcript = sanitizeUserText(correctVoiceTranscript(voiceTranscript || els.input.value));
  if (!transcript || voiceSubmitting) return;

  voiceSubmitting = true;
  shouldKeepListening = false;
  voiceTranscript = "";
  els.input.value = "";
  setVoiceStatus("Recebido. Processando.");

  if (isListening) {
    try {
      recognition.stop();
    } catch {
      // Recognition may already be stopping after the final result.
    }
  }

  addMessage("user", transcript);
  await respond(transcript);
}

function correctVoiceTranscript(text) {
  const value = String(text || "")
    .replace(/\b(?:parar|separar)\s+um rascunho\b/gi, "preparar um rascunho")
    .replace(/\bprepara um rascunho\b/gi, "preparar um rascunho")
    .replace(/\bagenda uma\s+(reuniao|reunião|evento|compromisso)\b/gi, "agende uma $1")
    .replace(/\bmarquei uma\s+(reuniao|reunião|evento|compromisso)\b/gi, "marque uma $1")
    .replace(/\bsexta feira\b/gi, "sexta-feira")
    .replace(/\bmeio dia\b/gi, "meio-dia")
    .replace(/\bmeia noite\b/gi, "meia-noite");

  return isLikelyEmailVoiceText(value) ? correctEmailPhonetics(value) : value;
}

function isLikelyEmailVoiceText(text) {
  const value = normalizeText(String(text || ""));
  return [
    "email", "e-mail", "gmail", "rascunho", "arroba", "a roupa",
    "a rouba", "hotmail", "outlook", "icloud", "yahoo", "proton"
  ].some((term) => value.includes(term));
}

function correctEmailPhonetics(text) {
  return String(text || "")
    .replace(/\brua[nm]?\s+richard\b/gi, "ruanrychard")
    .replace(/\b(?:amor|a mor)\s+(?:bye|by|bai)\s+(?:good|gude|cloud|claud)\b/gi, "arroba icloud")
    .replace(/\b(?:a roupa|a rouba|aroba|arrobas)\b/gi, "arroba")
    .replace(/\b(?:g\s*mail|ge\s*mail|gi\s*mail|gmaili|gemeio|g email)\b/gi, "gmail")
    .replace(/\b(?:hot\s*mail|roti\s*mail|rote\s*mail|hotmaili)\b/gi, "hotmail")
    .replace(/\b(?:out\s*look|alt\s*look|auto\s*look|outlooki)\b/gi, "outlook")
    .replace(/\b(?:i\s*cloud|ai\s*cloud|aicloud|iclaud|iclo+ud|icloud{2,})\b/gi, "icloud")
    .replace(/\b(?:ya\s*hoo|iahu|iarru)\b/gi, "yahoo")
    .replace(/\b(?:proton\s*mail|protom\s*mail)\b/gi, "protonmail")
    .replace(/\b(?:under\s*line|ander\s*line)\b/gi, "underline")
    .replace(/\b(?:sub\s*linhado|sublinado)\b/gi, "sublinhado")
    .replace(/\b(?:traco|trasso)\b/gi, "hifen")
    .replace(/\bponto neti\b/gi, "ponto net")
    .replace(/\bponto orgui\b/gi, "ponto org");
}

async function startListening() {
  const permission = await ensureMicrophonePermission();
  if (!permission) {
    shouldKeepListening = false;
    return;
  }

  if (isSpeaking) {
    setVoiceStatus("Estou falando agora. Volto a ouvir em seguida.");
    return;
  }

  try {
    els.input.value = "";
    recognition.start();
  } catch {
    setVoiceStatus("A voz ja esta inicializando. Aguarde um instante e tente de novo.");
  }
}

async function ensureMicrophonePermission() {
  if (microphoneReady) return true;

  if (!navigator.mediaDevices?.getUserMedia) {
    setVoiceStatus("Nao consegui acessar o microfone neste navegador. Use Chrome ou Edge.");
    return false;
  }

  try {
    setVoiceStatus("Pedindo permissao do microfone...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    microphoneReady = true;
    return true;
  } catch (error) {
    const blocked = error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
    setVoiceStatus(blocked ? "Microfone bloqueado. Permita o microfone nas configuracoes do navegador." : "Nao consegui abrir o microfone. Confira se ele esta conectado e livre.");
    return false;
  }
}

function describeVoiceError(error) {
  const messages = {
    "not-allowed": "Microfone bloqueado. Permita o microfone no navegador e tente de novo.",
    "service-not-allowed": "O servico de reconhecimento de voz foi bloqueado pelo navegador.",
    "audio-capture": "Nao encontrei entrada de audio. Confira o microfone padrao do Windows.",
    "network": "O reconhecimento de voz do navegador precisa de conexao ativa para processar a fala.",
    "no-speech": "Microfone ativo, mas nao detectei fala. Fale mais perto e tente novamente.",
    "aborted": "Captura de voz interrompida. Clique no nucleo JARVIS e tente de novo."
  };

  return messages[error] || "Nao consegui captar a voz agora. Digite /voz para diagnosticar.";
}

function getVoiceDiagnostic() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const support = Recognition ? "disponivel" : "indisponivel";
  const microphone = navigator.mediaDevices?.getUserMedia ? "acessivel pelo navegador" : "indisponivel pelo navegador";
  const secure = window.isSecureContext ? "sim" : "nao";

  return [
    `Diagnostico de voz: reconhecimento ${support}; microfone ${microphone}; contexto seguro: ${secure}.`,
    "Se estiver abrindo o index.html direto, prefira Chrome ou Edge e, se o microfone nao pedir permissao, abra por localhost.",
    "No navegador, confira o icone de permissao perto da barra de endereco e libere o microfone para esta pagina."
  ].join(" ");
}

function applyJarvisVoicePreset() {
  state.voiceMode = "on";
  state.voiceProvider = getDefaultTtsUrl() ? "external" : "browser";
  state.voiceRate = "0.80";
  state.voicePitch = "0.68";

  const voices = window.speechSynthesis?.getVoices?.() || [];
  const selected = pickCinematicVoice(voices);
  state.voiceName = selected?.name || "auto";
  saveState();
  render();
}

async function speak(text) {
  if (state.voiceMode !== "on" || !window.speechSynthesis) return;

  const spokenText = toSpokenText(text);

  if (state.voiceProvider === "external" && getDefaultTtsUrl()) {
    const played = await speakWithExternalTts(spokenText);
    if (played) return;
  }

  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = "pt-BR";
  utterance.rate = clampNumber(state.voiceRate, 0.72, 1.08, 0.8);
  utterance.pitch = clampNumber(state.voicePitch, 0.62, 1.02, 0.68);
  utterance.volume = 0.95;
  utterance.addEventListener("start", () => {
    isSpeaking = true;
    setVoiceStatus("Respondendo por voz.");
  });
  utterance.addEventListener("end", () => {
    isSpeaking = false;
    setVoiceStatus("Voz pronta. Clique no nucleo JARVIS para falar de novo.");
  });
  utterance.addEventListener("error", () => {
    isSpeaking = false;
    setVoiceStatus("Nao consegui falar a resposta agora.");
  });

  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = pickVoice(voices);
  if (selectedVoice) utterance.voice = selectedVoice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function speakWithExternalTts(text) {
  try {
    const ttsUrl = getDefaultTtsUrl();
    if (!ttsUrl) return false;

    isSpeaking = true;
    setVoiceStatus("Gerando voz customizada.");

    const headers = { "Content-Type": "application/json" };
    if (state.webhookToken) headers["X-Jarvis-Token"] = state.webhookToken;

    const response = await fetchWithTimeout(ttsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: truncateText(text, limits.replyLength),
        voiceName: state.voiceName,
        voiceRate: state.voiceRate,
        voicePitch: state.voicePitch,
        assistantName: state.assistantName || "Jarvis",
        userName: state.userName || "Chefe"
      })
    });

    if (!response.ok) throw new Error(`TTS respondeu ${response.status}`);

    const contentType = response.headers.get("content-type") || "";
    let audioSource = "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      audioSource = data.audioUrl || data.url || data.audio;
      if (!audioSource && data.audioBase64) {
        if (data.audioBase64.length > limits.maxAudioBytes * 1.4) throw new Error("audio too large");
        audioSource = `data:${data.mimeType || "audio/mpeg"};base64,${data.audioBase64}`;
      }
    } else {
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > limits.maxAudioBytes) throw new Error("audio too large");
      const blob = await response.blob();
      if (blob.size > limits.maxAudioBytes) throw new Error("audio too large");
      audioSource = URL.createObjectURL(blob);
    }

    if (audioSource && !isSafeAudioSource(audioSource)) throw new Error("unsafe audio source");
    if (!audioSource) throw new Error("TTS sem audio");

    await playAudio(audioSource);
    return true;
  } catch {
    isSpeaking = false;
    setVoiceStatus("Voz externa falhou. Usei a voz do navegador.");
    return false;
  }
}

function getDefaultTtsUrl() {
  const configuredUrl = getSafeHttpUrl(state.ttsWebhookUrl, { allowLocalhost: true });
  if (configuredUrl) return configuredUrl;
  if (isLocalHost(window.location.hostname) && window.location.protocol === "http:") return "/api/tts-elevenlabs";
  return "";
}

function playAudio(source) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(source);
    audio.addEventListener("play", () => {
      isSpeaking = true;
      setVoiceStatus("Respondendo com voz customizada.");
    });
    audio.addEventListener("ended", () => {
      isSpeaking = false;
      setVoiceStatus("Voz pronta. Clique no nucleo JARVIS para falar de novo.");
      resolve();
    });
    audio.addEventListener("error", () => {
      isSpeaking = false;
      reject(new Error("audio failed"));
    });
    audio.play().catch(reject);
  });
}

function toSpokenText(text) {
  return extractSpeakableText(text)
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s*\bID\s*:\s*[^\s.,;]+[.,;]?/gi, "")
    .replace(/[`*_#>{}\[\]"|]/g, "")
    .replace(/\b(model|created_at|done|context|total_duration|eval_count)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function extractSpeakableText(text) {
  const value = String(text || "").trim();
  if (!value.startsWith("{")) return value;

  try {
    const data = JSON.parse(value);
    return data.reply || data.response || data.message || value;
  } catch {
    return value;
  }
}

function setupSpeechVoices() {
  if (!window.speechSynthesis) return;

  const hydrate = () => {
    const voices = window.speechSynthesis.getVoices();
    const current = state.voiceName || "auto";

    els.voiceName.innerHTML = "";
    const auto = document.createElement("option");
    auto.value = "auto";
    auto.textContent = "Automatica mais natural";
    els.voiceName.append(auto);

    voices
      .filter((voice) => voice.lang.toLowerCase().startsWith("pt"))
      .sort((a, b) => voiceScore(b) - voiceScore(a))
      .forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        els.voiceName.append(option);
      });

    els.voiceName.value = [...els.voiceName.options].some((option) => option.value === current) ? current : "auto";
  };

  hydrate();
  window.speechSynthesis.addEventListener("voiceschanged", hydrate);
}

function pickVoice(voices) {
  if (state.voiceName && state.voiceName !== "auto") {
    const configured = voices.find((voice) => voice.name === state.voiceName);
    if (configured) return configured;
  }

  return voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("pt"))
    .sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}

function pickCinematicVoice(voices) {
  const candidates = voices.filter((voice) => voice.lang.toLowerCase().startsWith("pt"));
  return candidates.sort((a, b) => cinematicVoiceScore(b) - cinematicVoiceScore(a))[0];
}

function voiceScore(voice) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang === "pt-br") score += 10;
  if (name.includes("antonio")) score += 18;
  if (name.includes("daniel")) score += 14;
  if (name.includes("ricardo")) score += 12;
  if (name.includes("natural") || name.includes("neural") || name.includes("online")) score += 8;
  if (name.includes("microsoft")) score += 4;
  if (name.includes("maria") || name.includes("francisca") || name.includes("female")) score -= 8;
  if (voice.localService === false) score += 2;

  return score;
}

function cinematicVoiceScore(voice) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = voiceScore(voice);

  if (lang === "pt-br") score += 8;
  if (name.includes("antonio")) score += 12;
  if (name.includes("daniel")) score += 10;
  if (name.includes("ricardo")) score += 8;
  if (name.includes("natural") || name.includes("neural") || name.includes("online")) score += 8;
  if (name.includes("microsoft")) score += 4;
  if (name.includes("maria") || name.includes("francisca")) score -= 12;

  return score;
}

function updateVoiceControls() {
  els.micButton.classList.toggle("active", isListening);
  els.voiceToggle.classList.toggle("active", state.voiceMode === "on");
  els.voiceToggle.title = state.voiceMode === "on" ? "Voz ativa" : "Voz mutada";
  els.listenState.textContent = isListening ? "LISTENING" : "STANDBY";
}

function setVoiceStatus(text) {
  els.voiceStatus.textContent = text;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const nextState = { ...defaults, ...saved };
    if (!saved?.profileVersion) {
      if (!saved?.userName || saved.userName === "Voce") nextState.userName = "Chefe";
      if (!saved?.tone || saved.tone === "minimalista") nextState.tone = "estrategico";
      nextState.profileVersion = 2;
    }
    return nextState;
  } catch {
    return { ...defaults, profileVersion: 2 };
  }
}

function saveState() {
  pruneState();
  localStorage.setItem(storageKey, JSON.stringify(state));
  scheduleMemorySync();
}

function scheduleMemorySync() {
  if (!isLocalHost(window.location.hostname) || window.location.protocol !== "http:") return;
  window.clearTimeout(memorySyncTimer);
  memorySyncTimer = window.setTimeout(syncMemoryToServer, 900);
}

async function syncMemoryToServer({ appendHistory = false } = {}) {
  try {
    await fetchWithTimeout("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: state.tasks,
        priorities: state.priorities,
        contacts: state.contacts,
        recentMessages: state.messages.slice(-12).map(({ role, text }) => ({
          role,
          text: truncateText(text, 900)
        })),
        summary: buildMemorySummary(),
        appendHistory
      })
    });
  } catch {
    setVoiceStatus("Memoria local indisponivel. Mantive tudo no navegador.");
  }
}

function buildMemorySummary() {
  const tasks = state.tasks.slice(0, 5).join("; ") || "nenhuma tarefa registrada";
  const priorities = state.priorities.slice(0, 5).join("; ") || "prioridades ainda nao definidas";
  return `Tarefas: ${tasks}. Prioridades: ${priorities}.`;
}
