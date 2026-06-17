import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Contact, JarvisState } from "../types";
import { formatCalendar } from "../lib/jarvis";

export default function OperationsDrawer({
  open,
  onClose,
  state,
  setState,
  confirmEmail,
  confirmWhatsApp,
  confirmCalendar,
}: {
  open: boolean;
  onClose: () => void;
  state: JarvisState;
  setState: React.Dispatch<React.SetStateAction<JarvisState>>;
  confirmEmail: () => void;
  confirmWhatsApp: () => void;
  confirmCalendar: () => void;
}) {
  const [tab, setTab] = useState<"contacts" | "pending">("contacts");
  const [editing, setEditing] = useState("");
  const [form, setForm] = useState<Contact>({ name: "", email: "", phone: "" });
  const pendingCount = [
    state.pendingEmailDraft,
    state.pendingWhatsAppMessage,
    state.pendingCalendarEvent,
    state.pendingCalendarAction,
  ].filter(Boolean).length;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || (!form.email?.trim() && !form.phone?.trim())) return;
    setState((current) => {
      const contacts = [...current.contacts];
      const index = contacts.findIndex((item) => item.name === editing);
      const next = { ...form, name: form.name.trim(), updatedAt: new Date().toISOString() };
      if (index >= 0) contacts[index] = next;
      else contacts.unshift(next);
      return { ...current, contacts };
    });
    setEditing("");
    setForm({ name: "", email: "", phone: "" });
  }

  function edit(contact: Contact) {
    setEditing(contact.name);
    setForm(contact);
  }

  function remove(name: string) {
    setState((current) => ({
      ...current,
      contacts: current.contacts.filter((contact) => contact.name !== name),
    }));
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            className="drawer-backdrop"
            type="button"
            aria-label="Fechar painel"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="operations-drawer glass-panel"
            initial={{ x: "105%" }}
            animate={{ x: 0 }}
            exit={{ x: "105%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            <header>
              <div><small>Central operacional</small><h2>Contatos e pendências</h2></div>
              <button type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
            </header>
            <div className="drawer-tabs">
              <button className={tab === "contacts" ? "active" : ""} onClick={() => setTab("contacts")}>
                Contatos <span>{state.contacts.length}</span>
              </button>
              <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>
                Pendências <span>{pendingCount}</span>
              </button>
            </div>

            {tab === "contacts" ? (
              <div className="drawer-content">
                <form className="contact-form-react" onSubmit={submit}>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Nome"
                    required
                  />
                  <input
                    value={form.email || ""}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="Email (opcional)"
                    type="email"
                  />
                  <input
                    value={form.phone || ""}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="WhatsApp com DDD"
                  />
                  <button type="submit">{editing ? "Atualizar contato" : "Salvar contato"}</button>
                </form>
                <div className="drawer-list">
                  {state.contacts.map((contact) => (
                    <article key={contact.name}>
                      <div><strong>{contact.name}</strong><small>{contact.email || contact.phone}</small></div>
                      <span>
                        <button onClick={() => edit(contact)} aria-label="Editar"><Pencil size={15} /></button>
                        <button onClick={() => remove(contact.name)} aria-label="Excluir"><Trash2 size={15} /></button>
                      </span>
                    </article>
                  ))}
                  {!state.contacts.length && <p className="empty-state">Nenhum contato salvo.</p>}
                </div>
              </div>
            ) : (
              <div className="drawer-content drawer-list pending-list">
                {state.pendingEmailDraft && (
                  <article>
                    <div><small>Email</small><strong>{state.pendingEmailDraft.subject}</strong><p>Para: {state.pendingEmailDraft.to}</p></div>
                    <button className="confirm-action" onClick={confirmEmail}><Check size={15} /> Confirmar</button>
                  </article>
                )}
                {state.pendingWhatsAppMessage && (
                  <article>
                    <div><small>WhatsApp</small><strong>{state.pendingWhatsAppMessage.contactName}</strong><p>{state.pendingWhatsAppMessage.message}</p></div>
                    <button className="confirm-action" onClick={confirmWhatsApp}><Check size={15} /> Confirmar</button>
                  </article>
                )}
                {state.pendingCalendarEvent && (
                  <article>
                    <div><small>Agenda</small><strong>{state.pendingCalendarEvent.title}</strong><p>{formatCalendar(state.pendingCalendarEvent)}</p></div>
                    <button className="confirm-action" onClick={confirmCalendar}><Check size={15} /> Confirmar</button>
                  </article>
                )}
                {!pendingCount && <p className="empty-state">Nenhuma ação aguardando confirmação.</p>}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
