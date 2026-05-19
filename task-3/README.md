# Learning Assistant Bot

A Telegram bot that helps you learn from articles. Send a URL, get a summary, take a quiz.

## Try it 

Bot: [@MichalLearningBot](https://t.me/MichalLearningBot)
(zweryfikuj handle bota w Telegramie – w info bota)

## Commands

### /start
Shows a welcome message with usage instructions.

### /learn <url>
Submits a URL. The bot extracts the content, summarizes it, and saves it for quizzes.

Example:
/learn https://en.wikipedia.org/wiki/Photosynthesis

What you get:
- Article title
- 5–7 key points
- Main concepts
- Difficulty level (easy/intermediate/advanced)

### /quiz
Lists your saved materials. Pick one, get 5 multiple-choice questions, see your score with per-question feedback.

## Edge cases handled

- /learn without a URL → friendly "no URL detected" message
- /learn with broken/unreachable URL → friendly "couldn't reach" message
- /quiz with no materials yet → "you haven't learned anything yet" prompt

## How it works (high level)

Telegram message → n8n workflow → command router → AI Teacher (summary) or AI Examiner (quiz) → response back to Telegram. Materials and quiz sessions persist in n8n Data Tables, scoped per user.
