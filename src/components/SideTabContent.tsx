import {
  Bot,
  CalendarClock,
  CheckCircle2,
  Database,
  Mail,
  MessageCircle,
  Mic,
  Network,
  Play,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";
import type { JarvisState, Message } from "../types";

type SideTabContentProps = {
  active: string;
  state: JarvisState;
  setState: Dispatch<SetStateAction<JarvisState>>;
  setActive: (value: string) => void;
  setInput: (value: string) => void;
  openDrawer: () => void;
  demo: boolean;
  setDemo: (value: boolean) => void;
  lastCommand: string;
};

const commandExamples = [
  "resuma meus emails importantes de hoje",
  "prepare um rascunho para o Ruan sobre a reunião de amanhã",
  "agende uma reunião para sexta-feira às 15h",
  "salve o e-mail do Ruan como ruanrychard@icloud.com",
  "me mostre minhas próximas tarefas",
  "mande uma mensagem no WhatsApp avisando que chego em 10 minutos",
];

const automationItems = [
  { title: "Gmail inteligente", detail: "Leitura, resumo, rascunho e envio com confirmação.", icon: Mail, status: "Conectado" },
  { title: "Google Agenda", detail: "Criação de eventos, horários relativos e confirmação antes de criar.", icon: CalendarClock, status: "Conectado" },
  { title: "n8n Workflow", detail: "Ponte entre o front-end, automações e serviços externos.", icon: Workflow, status: "Operacional" },
  { title: "WhatsApp", detail: "Preparado para mensagens confirmadas quando a integração final entrar.", icon: MessageCircle, status: "Pendente" },
];

function formatMessage(message: Message) {
  const date = message.createdAt ? new Date(message.createdAt) : null;
  return date?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) || "Agora";
}

function connected(value: string) {
  return value === "configured";
}

export default function SideTabContent({
  active,
  state,
  setState,
  setActive,
  setInput,
  openDrawer,
  demo,
  setDemo,
  lastCommand,
}: SideTabContentProps) {
  function useCommand(command: string) {
    setInput(command);
    setActive("Início");
  }

  const pendingCount = [
    state.pendingEmailDraft,
    state.pendingWhatsAppMessage,
    state.pendingCalendarEvent,
    state.pendingCalendarAction,
  ].filter(Boolean).length;

  const messages = state.messages.length
    ? [...state.messages].slice(-12).reverse()
    : [{ role: "assistant", text: "Nenhuma conversa registrada ainda." } as Message];

  const content = {
    Conversas: (
      <>
        <TabHeader
          eyebrow="Histórico"
          title="Conversas recentes"
          description="Veja o contexto que o Jarvis está usando para continuar a conversa."
          actionLabel="Voltar ao chat"
          onAction={() => setActive("Início")}
        />
        <div className="tab-list">
          {messages.map((message, index) => (
            <article className={`tab-message ${message.role}`} key={`${message.createdAt || index}-${message.text}`}>
              <span>{message.role === "assistant" ? "JARVIS" : "RUAN"} · {formatMessage(message)}</span>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      </>
    ),
    Comandos: (
      <>
        <TabHeader
          eyebrow="Biblioteca"
          title="Comandos prontos"
          description="Atalhos para demonstrar voz, e-mail, agenda, memória e automações."
        />
        <div className="command-grid">
          {commandExamples.map((command) => (
            <button className="command-card" type="button" onClick={() => useCommand(command)} key={command}>
              <span><Play size={15} /></span>
              <p>{command}</p>
            </button>
          ))}
        </div>
      </>
    ),
    Automações: (
      <>
        <TabHeader
          eyebrow="Execução"
          title="Automações conectadas"
          description="Fluxos que transformam conversa em ação, sempre com confirmação quando envolve envio ou agenda."
          actionLabel="Abrir pendências"
          onAction={openDrawer}
        />
        <div className="tab-card-grid">
          {automationItems.map(({ title, detail, icon: Icon, status }) => (
            <article className="tab-card" key={title}>
              <span className="tab-card-icon"><Icon size={18} /></span>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
                <small>{status}</small>
              </div>
            </article>
          ))}
        </div>
      </>
    ),
    Memória: (
      <>
        <TabHeader
          eyebrow="Contexto"
          title="Memória operacional"
          description="Informações que ajudam o Jarvis a responder com mais contexto."
          actionLabel="Gerenciar contatos"
          onAction={openDrawer}
        />
        <div className="tab-split">
          <section className="tab-panel">
            <h3>Tarefas</h3>
            {(state.tasks.length ? state.tasks : ["Revisar oportunidades de estágio", "Testar automações do Jarvis"]).slice(0, 6).map((task) => (
              <div className="memory-row" key={task}><CheckCircle2 size={15} /><span>{task}</span></div>
            ))}
          </section>
          <section className="tab-panel">
            <h3>Contatos</h3>
            {(state.contacts.length ? state.contacts : [{ name: "Ruan", email: "ruanrychard@icloud.com" }]).slice(0, 6).map((contact) => (
              <div className="memory-row" key={contact.name}>
                <Database size={15} />
                <span>{contact.name}<small>{contact.email || contact.phone || "Sem canal salvo"}</small></span>
              </div>
            ))}
          </section>
        </div>
      </>
    ),
    Integrações: (
      <>
        <TabHeader
          eyebrow="Conexões"
          title="Integrações do Jarvis"
          description="Status dos serviços usados para voz, automações, e-mail, agenda e mensagens."
        />
        <div className="integration-matrix">
          <IntegrationStatus icon={Workflow} label="n8n" status="Conectado" online />
          <IntegrationStatus icon={Radio} label="ElevenLabs" status="Conectado" online />
          <IntegrationStatus icon={Mail} label="Gmail" status={connected(state.integrations.email) ? "Conectado" : "Pendente"} online={connected(state.integrations.email)} />
          <IntegrationStatus icon={CalendarClock} label="Agenda" status={connected(state.integrations.calendar) ? "Conectado" : "Pendente"} online={connected(state.integrations.calendar)} />
          <IntegrationStatus icon={MessageCircle} label="WhatsApp" status={connected(state.integrations.whatsapp) ? "Conectado" : "Pendente"} online={connected(state.integrations.whatsapp)} />
          <IntegrationStatus icon={Network} label="Instagram" status={connected(state.integrations.instagram) ? "Conectado" : "Futuro"} online={connected(state.integrations.instagram)} />
        </div>
      </>
    ),
    Configurações: (
      <>
        <TabHeader
          eyebrow="Preferências"
          title="Configurações rápidas"
          description="Ajustes visuais e de voz para demonstrar o Jarvis com segurança."
        />
        <div className="settings-grid">
          <SettingCard icon={Mic} title="Voz">
            <button
              type="button"
              className={state.voiceMode === "on" ? "setting-toggle active" : "setting-toggle"}
              onClick={() => setState((current) => ({ ...current, voiceMode: current.voiceMode === "on" ? "off" : "on" }))}
            >
              {state.voiceMode === "on" ? "Voz ligada" : "Voz desligada"}
            </button>
          </SettingCard>
          <SettingCard icon={Sparkles} title="Demonstração">
            <button
              type="button"
              className={demo ? "setting-toggle active" : "setting-toggle"}
              onClick={() => setDemo(!demo)}
            >
              {demo ? "Modo demo ativo" : "Ativar modo demo"}
            </button>
          </SettingCard>
          <SettingCard icon={Settings} title="Motor de voz">
            <div className="segmented-control">
              {(["external", "browser"] as const).map((provider) => (
                <button
                  type="button"
                  className={state.voiceProvider === provider ? "active" : ""}
                  onClick={() => setState((current) => ({ ...current, voiceProvider: provider }))}
                  key={provider}
                >
                  {provider === "external" ? "ElevenLabs" : "Navegador"}
                </button>
              ))}
            </div>
          </SettingCard>
          <SettingCard icon={ShieldCheck} title="Segurança">
            <p className="settings-note">
              {pendingCount ? `${pendingCount} ação aguardando confirmação.` : "Nada é enviado sem confirmação explícita."}
            </p>
          </SettingCard>
        </div>
      </>
    ),
  }[active] || null;

  return (
    <motion.section
      className="tab-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {content}
      <div className="tab-footer-note">
        <Bot size={15} />
        <span>Último comando: {lastCommand || "aguardando primeira instrução"}</span>
      </div>
    </motion.section>
  );
}

function TabHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <header className="tab-header">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>{actionLabel}</button>
      )}
    </header>
  );
}

function IntegrationStatus({
  icon: Icon,
  label,
  status,
  online,
}: {
  icon: LucideIcon;
  label: string;
  status: string;
  online: boolean;
}) {
  return (
    <article className="integration-status">
      <span className="tab-card-icon"><Icon size={18} /></span>
      <div>
        <strong>{label}</strong>
        <small>{status}</small>
      </div>
      <i className={online ? "online" : ""} />
    </article>
  );
}

function SettingCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="setting-card">
      <span className="tab-card-icon"><Icon size={18} /></span>
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </section>
  );
}
