import {
  CalendarClock,
  CheckCircle2,
  CloudSun,
  Mail,
  MessageCircle,
  Radio,
  Workflow,
} from "lucide-react";
import type { JarvisState } from "../types";

function Integration({
  icon: Icon,
  label,
  connected,
}: {
  icon: typeof Radio;
  label: string;
  connected: boolean;
}) {
  return (
    <div className="integration-row">
      <span className="integration-icon"><Icon size={17} /></span>
      <div><strong>{label}</strong><small>{connected ? "Conectado" : "Pendente"}</small></div>
      <span className={`connection-dot ${connected ? "connected" : ""}`} />
    </div>
  );
}

export default function RightPanel({
  state,
  lastCommand,
}: {
  state: JarvisState;
  lastCommand: string;
}) {
  return (
    <aside className="right-panel">
      <section className="info-card weather-card">
        <div className="weather-icon"><CloudSun size={24} /></div>
        <div><strong>24°C</strong><small>Parcialmente nublado</small></div>
      </section>

      <section className="info-card">
        <div className="card-heading">
          <span>Próximas tarefas</span>
          <CalendarClock size={16} />
        </div>
        <div className="task-list">
          {(state.tasks.length ? state.tasks : [
            "Revisar oportunidades de estágio",
            "Organizar prioridades da semana",
            "Testar automações do Jarvis",
          ]).slice(0, 3).map((task, index) => (
            <div className="task-row" key={`${task}-${index}`}>
              <CheckCircle2 size={17} />
              <div><strong>{task}</strong><small>{index === 0 ? "Hoje" : "Próximo passo"}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="info-card">
        <div className="card-heading"><span>Último comando</span><Radio size={16} /></div>
        <p className="last-command">“{lastCommand || "Aguardando sua primeira instrução"}”</p>
        <small className="success-line"><CheckCircle2 size={13} /> Sistema operacional</small>
      </section>

      <section className="info-card integrations-card">
        <div className="card-heading"><span>Integrações</span><Workflow size={16} /></div>
        <Integration icon={Workflow} label="n8n" connected />
        <Integration icon={Radio} label="ElevenLabs" connected />
        <Integration icon={Mail} label="Gmail" connected={state.integrations.email === "configured"} />
        <Integration icon={CalendarClock} label="Agenda" connected={state.integrations.calendar === "configured"} />
        <Integration icon={MessageCircle} label="WhatsApp" connected={state.integrations.whatsapp === "configured"} />
      </section>
    </aside>
  );
}
