---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch a code reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history.

**Core principle:** Review early, review often.

## Idioma obligatorio

Todos los resultados de revisión, resúmenes y respuestas al usuario se escriben
en español, incluidos los encabezados, las severidades y el veredicto. No traduzcas
símbolos, rutas, comandos ni mensajes de error citados como evidencia.
Pasa esta exigencia explícitamente al reviewer usando [code-reviewer.md](code-reviewer.md).

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code reviewer subagent:**

Dispatch a `general-purpose` subagent, filling the template at [code-reviewer.md](code-reviewer.md)

**Placeholders:**
- `{DESCRIPTION}` - Brief summary of what you built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit

**3. Publicar automáticamente el resultado en la PR:**

El agente coordinador es el único responsable de publicar; el reviewer devuelve
el informe y no escribe en GitHub. La publicación es obligatoria al ejecutar esta
skill, sin pedir confirmación, incluso cuando no hay hallazgos. Esto no instala
un bot de CI ni dispara revisiones por cada push.

1. Guarda el reporte completo en español en un archivo temporal UTF-8 fuera del
   repositorio. Incluye el SHA base y el SHA revisado, el alcance, las verificaciones
   realmente ejecutadas y las limitaciones. Nunca publiques secretos ni datos sensibles.
2. Comprueba `gh auth status`. Resuelve el repositorio y la rama revisada explícitamente;
   no uses la primera PR del repositorio ni una PR inferida desde otra rama.
   Usa `gh pr list --repo "$REPO" --head "$BRANCH" --state open --json number,url,headRefOid,headRepositoryOwner`
   y confirma también el propietario de la rama en caso de forks. Si hay varias
   coincidencias, resuelve la PR por su rama base y contexto antes de publicar.
3. Si todavía no existe una PR, conserva el reporte como pendiente y publícalo
   inmediatamente después de crearla. No crees una PR solo para publicar sin que
   se haya solicitado. Si hay cambios sin commit, identifica el alcance local;
   antes de publicarlo, confirma que esos mismos cambios están en el commit remoto.
4. Antes de publicar, consulta `gh pr view "$PR_NUMBER" --repo "$REPO" --json state,headRefOid,url`.
   Publica solo en la PR abierta correcta. Si su HEAD difiere del SHA revisado,
   actualiza la revisión para ese HEAD; nunca presentes un reporte viejo como vigente.
5. Publica el informe completo como comentario, no como aprobación de la propia PR:
   ```bash
   gh pr comment "$PR_NUMBER" --repo "$REPO" --body-file "$REPORT_FILE"
   ```
   Conserva la URL devuelta y verifica que el comentario existe con
   `gh pr view "$PR_NUMBER" --repo "$REPO" --json comments`. No dupliques una
   publicación ya confirmada del mismo reporte; revisa los comentarios antes de
   repetir un comando cuyo resultado sea incierto.
6. Si falta `gh`, autenticación, permisos o conectividad, entrega el reporte en
   español e indica que la publicación sigue pendiente y por qué. No afirmes
   que se publicó ni pierdas el archivo. Tras confirmar la publicación, elimina
   el archivo temporal y devuelve la URL del comentario al usuario.

**4. Actuar sobre el resultado:**
- Corregir problemas Críticos inmediatamente.
- Corregir problemas Importantes antes de continuar.
- Registrar problemas Menores para su consideración.
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code reviewer subagent]
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types
  PLAN_OR_REQUIREMENTS: tarea 2 de openspec/changes/<cambio>/tasks.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[Subagent returns]:
  Fortalezas: Arquitectura clara, pruebas de comportamiento
  Problemas:
    Importante: No se informa el progreso de una operación prolongada
    Menor: Número mágico (100) en el intervalo de reporte
  Veredicto: Con correcciones

Coordinador: [Publica el reporte completo en la PR y conserva la URL]
Coordinador: [Corrige los problemas y solicita una revisión del nuevo SHA]
[Continúa con la tarea 3]
```

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll just review the diff myself instead of dispatching a reviewer" | You're the coordinator — reviewing the diff inline burns the context window you need to keep driving the work. Dispatch a reviewer subagent: the diff and the evaluation live in its context, and only the findings come back to you. |
| "The reviewer needs my whole session history to understand the change" | Hand it precisely crafted context, never your session's history. That keeps the reviewer on the work product, not your thought process. |

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: [code-reviewer.md](code-reviewer.md)
