# Webhook de Voz TTS

Este arquivo define como o Jarvis chama um motor de voz externo pelo n8n.

## Objetivo

Permitir que o Jarvis use uma voz customizada por API, como ElevenLabs, OpenAI TTS ou outro servico, em vez da voz padrao do navegador.

## Entrada enviada pelo Jarvis

O Jarvis faz um `POST` para o webhook configurado em `Webhook de voz TTS`.

Se `Token do webhook` estiver configurado no painel, o Jarvis tambem envia:

```text
X-Jarvis-Token: valor_do_token
```

```json
{
  "text": "Texto que deve ser falado.",
  "voiceName": "auto",
  "voiceRate": "0.86",
  "voicePitch": "0.82",
  "assistantName": "Jarvis",
  "userName": "Chefe"
}
```

## Respostas aceitas

### Opcao 1: JSON com URL de audio

```json
{
  "audioUrl": "https://exemplo.com/audio.mp3"
}
```

Tambem aceita `url` ou `audio`.

### Opcao 2: JSON com base64

```json
{
  "audioBase64": "BASE64_DO_AUDIO",
  "mimeType": "audio/mpeg"
}
```

### Opcao 3: audio direto

O n8n pode responder diretamente com um arquivo de audio, como `audio/mpeg` ou `audio/wav`.

## Configuracao na interface

1. Abra o painel `Cfg`.
2. Em `Motor de voz`, escolha `TTS via n8n`.
3. Em `Webhook de voz TTS`, cole a URL do webhook.
4. Use `/testetts` para testar.

Se o webhook falhar, o Jarvis volta automaticamente para a voz do navegador.

Por seguranca, use HTTPS para webhooks publicados na internet. URLs `http://` devem ficar restritas a `localhost`, `127.0.0.1` ou ambiente local de teste.
