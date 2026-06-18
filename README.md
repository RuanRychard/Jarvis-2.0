# Jarvis 2.0

Interface premium de assistente pessoal com voz, memoria local, automacoes via n8n e integracoes com Gmail, Google Agenda, ElevenLabs, Ollama e fluxos futuros de WhatsApp.

[Acessar a pagina publica do Jarvis 2.0](https://ruanrychard.github.io/Jarvis-2.0/)

O foco do projeto e ser apresentavel em portfolio e entrevista: uma tela limpa, dark, responsiva, com orb central animada, comandos por voz/texto e acoes sempre confirmadas antes de enviar emails, mensagens ou criar eventos.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- React Three Fiber / Three.js
- n8n
- Docker
- Python server local

## O que esta pronto

- Interface dark premium com orb 3D animada.
- Estados visuais: aguardando, escutando, pensando e respondendo.
- Input por texto e botao de microfone.
- Sidebar funcional com abas:
  - Inicio
  - Conversas
  - Comandos
  - Automacoes
  - Memoria
  - Integracoes
  - Configuracoes
- Central de contatos e pendencias.
- Modo demo para apresentacao.
- Responsivo para desktop, notebook, tablet e mobile.
- Sem rolagem lateral global.
- Gmail e Agenda preparados para uso via n8n.
- ElevenLabs preparado para TTS externo.
- Fluxo de confirmacao antes de envio.

## Como rodar o frontend em desenvolvimento

```powershell
npm install
npm run dev
```

Abra a URL exibida pelo Vite, normalmente:

```text
http://localhost:5173
```

## Como gerar build final

```powershell
npm run build
```

O build fica em:

```text
dist/
```

## Como ligar o Jarvis completo

Use o script:

```powershell
.\start_jarvis.ps1
```

Ele tenta:

- iniciar o Docker Desktop;
- subir o n8n com `docker compose up -d`;
- criar backup automatico;
- iniciar o servidor local do Jarvis;
- abrir o navegador em:

```text
http://127.0.0.1:8787
```

Para desligar:

```powershell
.\stop_jarvis.ps1
```

## n8n

O n8n roda em:

```text
http://localhost:5678
```

O arquivo principal para importar no n8n e:

```text
n8n-workflow-template.json
```

Variaveis ficam em `.env`. Use `.env.example` como base:

```text
TAVILY_API_KEY=
JARVIS_WEBHOOK_TOKEN=
N8N_WEBHOOK_URL=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_API_VERSION=
```

## Integracoes

Status atual do projeto:

- n8n: conectado localmente via Docker.
- Gmail: preparado e usado pelo n8n com OAuth.
- Google Agenda: preparado e usado pelo n8n com OAuth.
- ElevenLabs: preparado para voz externa.
- Ollama: usado como modelo local pelo workflow.
- WhatsApp: tela preparada; envio depende da configuracao final da API oficial.

Regras de seguranca:

- Leitura pode acontecer quando a integracao estiver conectada.
- Envio de email, mensagem ou evento sempre exige confirmacao.
- O Jarvis nao deve fingir acesso a uma conta que ainda nao foi conectada.

## Comandos bons para demonstrar

```text
resuma meus emails importantes de hoje
```

```text
prepare um rascunho para o Ruan sobre a reuniao de amanha
```

```text
agende uma reuniao para sexta-feira as 15h
```

```text
salve o e-mail do Ruan como ruanrychard@icloud.com
```

```text
me mostre minhas proximas tarefas
```

```text
mande uma mensagem no WhatsApp avisando que chego em 10 minutos
```

## Roteiro rapido para entrevista

1. Abra o Jarvis na tela inicial.
2. Mostre a orb e os estados visuais.
3. Ative o modo demo.
4. Mostre a aba `Comandos` e clique em um comando pronto.
5. Mostre `Automacoes` para explicar Gmail, Agenda, n8n e WhatsApp.
6. Mostre `Memoria` para tarefas e contatos.
7. Mostre `Integracoes` para status dos servicos.
8. Finalize em `Configuracoes`, explicando voz, demo e confirmacao de seguranca.

## Arquivos importantes

- `src/App.tsx`: tela principal e fluxo do assistente.
- `src/components/OrbScene3D.tsx`: orb 3D em React Three Fiber.
- `src/components/VoiceOrb.tsx`: fallback canvas, microfone e badge de status.
- `src/components/SideTabContent.tsx`: conteudo das abas laterais.
- `src/styles.css`: visual global e responsividade.
- `jarvis_server.py`: servidor local.
- `start_jarvis.ps1`: script para ligar o Jarvis completo.
- `docker-compose.yml`: container do n8n.
- `n8n-workflow-template.json`: workflow base do n8n.
- `integracoes-e-permissoes.md`: regras e permissoes das integracoes.

## Proximos passos

- Criar um instalador ou script mais simples para rodar em outro PC.
- Finalizar WhatsApp com API oficial.
- Melhorar o empacotamento do n8n para importacao guiada.
- Criar deploy publico somente da interface de portfolio, sem expor tokens.
