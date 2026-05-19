# Task 3 – Learning Assistant Bot – Report

## Tools and techniques

- **n8n cloud** – visual workflow editor for the entire bot logic
- **Telegram Bot API** – via @BotFather to create the bot, and HTTP Request nodes for sending messages with inline keyboards
- **Anthropic Claude (Sonnet)** – via n8n's AI Agent node, in two distinct roles:
  - Teacher: analyzes article content, returns structured JSON (key points, main concepts, difficulty, formatted summary)
  - Examiner: generates 5 multiple-choice questions per material, with correct answers and explanations
- **n8n Data Tables** – for persistence: `learning_materials` (URL, title, content, summary, user_id) and `quiz_sessions` (user_id, material_id, questions, current_question, answers, status)
- **Claude Opus 4.7** – my strategic partner throughout development, helping debug nodes, write Code node JS, structure prompts, and handle edge cases

## What worked

- AI Agent + structured JSON output (instructing the model to return strict JSON, no markdown fences) made downstream processing reliable
- Inline keyboards with `callback_data` like `qm:<material_id>` and `qa:<session_id>:<answer>` cleanly encoded state into Telegram buttons
- HTTP Request "Continue on Error" + dedicated terminal Telegram node for graceful failure messages
- Filtering Get row(s) by user_id at the /quiz listing step gave proper multi-user isolation with zero extra logic

## What did not work (and how it was fixed)

- **`reply_markup: null` crashes Telegram** – fixed by using `{ inline_keyboard: [] }` for messages with no buttons
- **Get row(s) returning 0 items stopped the workflow silently** – fixed by enabling "Always Output Data" + filtering placeholder in the downstream Code node
- **Duplicate Telegram messages** – traced to an unwanted connection between two Send a text message nodes; fixed by deleting the redundant node and reconnecting HTTP Request directly to Code in JavaScript
- **Newlines collapsed to spaces in Telegram Text field** – fixed by switching to expression mode with explicit `\n`

## Notable decisions

- **Multiple-choice answer validation by exact match** on A/B/C/D, not free-text semantic match: discrete buttons make exact match the natural and standard approach; the "intelligent" part of validation lives in the Examiner AI generating the questions, correct answers, and the explanation feedback
- **No workflow restart between commands** – the workflow is set to Active so all Telegram updates are handled in production mode automatically
- **Separate error messages for "no URL provided" vs "bad URL"** – better UX than a single generic error, implemented via an If node before HTTP Request + Continue on Error on HTTP Request
- **user_id scoping** stored as Telegram chat.id in both data tables, so each user only sees their own materials and quiz sessions
