# Arquitetura Sugerida no n8n

Este fluxo replica a ideia do video, mas deixa espaco para a sua personalidade.

## Fluxo basico

1. **Webhook / Chat Trigger**
   - Recebe mensagem por WhatsApp, Telegram, site ou endpoint.

2. **Normalizacao**
   - Limpa texto.
   - Detecta canal de origem.
   - Identifica usuario.

3. **Memoria**
   - Busca preferencias do usuario.
   - Busca contexto recente.
   - Busca dados em notas, banco ou planilha.

4. **AI Agent**
   - Usa `prompt_sistema.md`.
   - Recebe o perfil preenchido em `personalidade.md`.
   - Decide se responde direto ou chama ferramentas.

5. **Ferramentas**
   - Google Calendar para agenda.
   - Gmail/Outlook para email.
   - Notion/Google Sheets para memoria.
   - HTTP Request para APIs externas.
   - WhatsApp/Telegram para resposta.

6. **Confirmacao**
   - Para acoes sensiveis, pede aprovacao antes:
     - enviar email;
     - apagar dados;
     - comprar algo;
     - publicar conteudo;
     - acionar terceiros.

7. **Resposta**
   - Responde no mesmo canal de entrada.
   - Salva resumo da conversa na memoria.

## Memorias recomendadas

- `perfil_usuario`: gostos, tom, limites, preferencias.
- `projetos`: objetivos ativos e contexto.
- `pessoas`: nomes, relacoes e observacoes relevantes.
- `tarefas`: pendencias e proximas acoes.
- `historico_resumido`: resumo das interacoes importantes.

## Regra de ouro

Personalidade nao e so "falar bonito". Ela aparece em como o assistente decide, prioriza, cobra, protege seu tempo e entende o que combina com voce.

