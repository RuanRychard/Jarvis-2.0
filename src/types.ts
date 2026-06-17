export type AssistantStatus = "idle" | "listening" | "thinking" | "responding";

export type Message = {
  role: "assistant" | "user";
  text: string;
  createdAt?: string;
};

export type Contact = {
  name: string;
  email?: string;
  phone?: string;
  updatedAt?: string;
};

export type PendingEmail = {
  to: string;
  subject: string;
  message: string;
  draftId?: string;
};

export type PendingWhatsApp = {
  to: string;
  contactName?: string;
  message: string;
};

export type PendingCalendarEvent = {
  title: string;
  start: string;
  end: string;
  description?: string;
  reminderMinutes?: number | null;
};

export type JarvisState = {
  assistantName: string;
  userName: string;
  voiceMode: "on" | "off";
  voiceProvider: "browser" | "external";
  voiceName: string;
  voiceRate: string;
  voicePitch: string;
  webhookUrl: string;
  webhookToken: string;
  webhookHealthy: boolean;
  messages: Message[];
  tasks: string[];
  priorities: string[];
  contacts: Contact[];
  pendingEmailDraft: PendingEmail | null;
  pendingWhatsAppMessage: PendingWhatsApp | null;
  pendingCalendarEvent: PendingCalendarEvent | null;
  pendingCalendarAction: Record<string, unknown> | null;
  integrations: {
    email: string;
    calendar: string;
    whatsapp: string;
    instagram: string;
  };
};

export type ActionIntent = Record<string, unknown> | null;
