# Backup do Jarvis

O Jarvis cria no maximo um backup por dia ao iniciar.

Os arquivos ficam em `backups/` no formato:

`jarvis-backup-AAAAMMDD-HHMMSS.zip`

O pacote inclui:

- codigo e configuracoes publicas do projeto;
- workflow publicado do n8n;
- memoria, tarefas e contatos locais;
- manifesto com hashes SHA-256.

O pacote nao inclui:

- `.env`;
- chaves de API;
- tokens OAuth;
- segredos de cliente;
- banco interno do n8n;
- logs.

## Backup manual

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backup_jarvis.ps1 -Force
```

## Restauracao segura

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\restore_jarvis.ps1 -BackupPath ".\backups\jarvis-backup-AAAAMMDD-HHMMSS.zip"
```

A restauracao extrai para uma pasta separada e nao sobrescreve o projeto atual.

Para importar tambem o workflow:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\restore_jarvis.ps1 -BackupPath ".\backups\jarvis-backup-AAAAMMDD-HHMMSS.zip" -ImportWorkflow
```

Credenciais do Gmail, Google Agenda, Tavily e ElevenLabs precisam ser reconectadas manualmente.
