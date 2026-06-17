# Integracoes e Permissoes do Jarvis

Este documento define como o Jarvis deve acessar email, WhatsApp, Instagram e outros canais.

## Regra principal

Jarvis nunca deve fingir acesso a uma conta. Se uma integracao nao estiver configurada, ele deve dizer isso com clareza.

Para qualquer acao sensivel, Jarvis deve pedir confirmacao antes de executar.

Webhooks expostos fora da maquina local devem usar token compartilhado. No projeto, o front envia `X-Jarvis-Token` quando o campo `Token do webhook` esta preenchido, e o workflow do n8n valida esse header antes de executar ferramentas.

## Niveis de permissao

### Leitura

Permite consultar informacoes e resumir para o usuario.

Exemplos:

- ler emails recentes;
- procurar emails por assunto;
- resumir conversas;
- listar mensagens pendentes.

### Escrita com confirmacao

Permite preparar uma resposta, mas nao enviar automaticamente.

Exemplos:

- redigir email;
- preparar resposta no WhatsApp;
- preparar mensagem de direct;
- preparar legenda ou postagem.

### Escrita automatica

Nao usar por padrao.

So deve ser ativada para tarefas muito especificas, com regra clara e baixo risco.

## Email

Recomendado para comecar.

### Caminho seguro

- Gmail ou Microsoft Outlook via credenciais OAuth no n8n.
- Comecar com permissao de leitura.
- Depois permitir rascunho de resposta.
- Envio sempre com confirmacao do Chefe.
- O navegador do Jarvis nao deve armazenar senha, refresh token ou chave OAuth do email.
- Use `/gmailon` apenas depois que a credencial OAuth estiver configurada no n8n.

### Comandos esperados

- "Jarvis, veja meus emails importantes."
- "Jarvis, tem algum email urgente?"
- "Jarvis, procure emails sobre vaga de estagio."
- "Jarvis, prepare uma resposta para esse email."

### Intencoes enviadas ao n8n

O front envia `profile.actionIntent` para o workflow:

- `summarize_inbox`: resumo dos emails recentes.
- `important_emails`: emails urgentes/importantes.
- `career_emails`: emails sobre vaga, estagio, curriculo, LinkedIn ou entrevista.
- `search_emails`: busca por termo.
- `draft_email`: preparar rascunho sem enviar.

## WhatsApp

Mais delicado que email.

### Caminho oficial

- WhatsApp Business Cloud API.
- Normalmente exige numero/business configurado na Meta.
- Bom para automacoes, notificacoes e atendimento.

### Risco

Usar automacao nao oficial do WhatsApp Web pode quebrar, violar regras da plataforma ou expor dados.

### Comandos esperados

- "Jarvis, veja minhas mensagens do WhatsApp."
- "Jarvis, prepare uma resposta para fulano."
- "Jarvis, mande uma mensagem para fulano dizendo que vou responder depois."

### Fluxo implementado

- O contato pode guardar email e telefone com DDD.
- O Jarvis prepara uma previa antes de qualquer envio.
- A mensagem pode ser alterada ou cancelada enquanto estiver pendente.
- O envio so e solicitado ao n8n depois do comando `confirmar WhatsApp`.
- O workflow valida novamente confirmacao, telefone e texto antes de chamar a API.
- Use `/whatsappon` somente depois de conectar a credencial oficial no n8n e escolher o numero remetente.

### Credencial local

Copie da tela `WhatsApp > API Setup` da Meta:

- API Access Token;
- Phone Number ID;
- versao atual da Graph API exibida na documentacao da Meta.

Guarde esses valores apenas no `.env`:

```text
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_GRAPH_API_VERSION=vXX.X
```

O `.env` nao entra nos backups do Jarvis. Depois reinicie o n8n com `docker compose up -d`.

## Instagram

Tambem exige cuidado.

### Caminho oficial

- Instagram API / Instagram Messaging API.
- Normalmente depende de conta profissional, pagina conectada e permissoes da Meta.

### Risco

Automacao nao oficial para direct, login ou scraping pode ser instavel e arriscada.

### Comandos esperados

- "Jarvis, veja se tenho directs importantes."
- "Jarvis, prepare uma resposta para esse direct."
- "Jarvis, me ajude a criar uma legenda."

## Ordem recomendada

1. Email com leitura.
2. Email com rascunho de resposta.
3. WhatsApp com envio confirmado.
4. Instagram com leitura/rascunho, se a conta permitir API oficial.

## Confirmacoes obrigatorias

Jarvis sempre deve confirmar antes de:

- enviar email;
- enviar WhatsApp;
- responder direct;
- publicar post;
- apagar mensagens;
- arquivar conversas;
- baixar anexos suspeitos;
- compartilhar dados pessoais.
