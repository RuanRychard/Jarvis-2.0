import {
  Bot,
  BrainCircuit,
  ChevronLeft,
  Command,
  History,
  Home,
  Menu,
  Network,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { label: "Início", icon: Home },
  { label: "Conversas", icon: History },
  { label: "Comandos", icon: Command },
  { label: "Automações", icon: Workflow },
  { label: "Memória", icon: BrainCircuit },
  { label: "Integrações", icon: Network },
  { label: "Configurações", icon: Settings },
];

export default function Sidebar({
  collapsed,
  setCollapsed,
  active,
  setActive,
  demo,
  setDemo,
}: {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  active: string;
  setActive: (value: string) => void;
  demo: boolean;
  setDemo: (value: boolean) => void;
}) {
  return (
    <motion.aside
      className="sidebar glass-panel"
      animate={{ width: collapsed ? 82 : 228 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <div className="brand">
        <span className="brand-mark"><Bot size={22} /></span>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <strong>JARVIS</strong>
            <small>OS 2.0</small>
          </motion.div>
        )}
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="nav-list">
        {items.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={active === label ? "active" : ""}
            onClick={() => setActive(label)}
            title={collapsed ? label : undefined}
          >
            <Icon size={19} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="profile-mini">
            <span className="avatar">R</span>
            <div><strong>Ruan</strong><small>Online</small></div>
          </div>
        )}
        <button
          type="button"
          className={`demo-button ${demo ? "active" : ""}`}
          onClick={() => setDemo(!demo)}
          title={collapsed ? "Modo demo" : undefined}
        >
          <Sparkles size={18} />
          {!collapsed && <span>{demo ? "Demo ativa" : "Modo demo"}</span>}
        </button>
      </div>
    </motion.aside>
  );
}
