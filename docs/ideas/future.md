# Future Ideas

[Docs](../README.md)

This file is not implementation scope. Move an idea into `core/` or `progress/current.md` only when it becomes a committed near-term decision.

## v0.5

- Registration/login
- Encrypted user tokens
- Async sync jobs
- CSV / Anki import
- Initialization choice:
  - continue external app usage
  - migrate into LexiForge
- Rate limiting and production security hardening

## v1

- LexiForge primary vocabulary mode
- SRS/review queue
- Reading comprehension and fill-blank exercises
- Mistake tracking
- Learning reports
- AI usage logs and quota control

## Exam Mode

Potential commercial direction:

- user selects CET4/CET6/IELTS/TOEFL/GRE
- weak score gets exam-match bonus
- article prompts match exam style
- future dictionary seed can use ECDICT or another licensed dataset

Keep this out of MVP until there is real usage feedback.

## AI Review Mode

Potential differentiator:

- user explains a word in their own words
- AI judges correct / partial / wrong
- event feeds SRS

This should use a proven SRS algorithm such as FSRS or SM-2. Do not invent a review scheduler from scratch.

## Commercial Notes

Possible paid features:

- more article generations
- long articles
- exam-specific mode
- weekly/monthly reports
- PDF export
- multi-model selection

Cost controls:

- daily generation limits
- model choice by plan
- retry limits
- token usage logging

## Resume Notes

If needed later, write a separate concise resume note from actual implemented features. Do not let resume wording drive product scope.
