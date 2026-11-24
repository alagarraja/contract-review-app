# Contract Review App

A simple web app for reviewing a contract with a chat assistant. Upload a PDF on the left, ask questions on the right, and get answers with the supporting clauses.

Built with plain HTML, CSS and JavaScript. No frameworks, no npm, no build step.

## Key features

- **PDF preview:** drag and drop a contract, or browse for one. It displays in the left panel, with the file name and size shown above it.
- **Chat panel:** the right panel is independent of the contract, so both stay visible and scroll separately.
- **Cited answers:** each question is sent, together with the PDF, to an n8n webhook. The reply shows the answer, the exact clauses that support it (citations) and a short reasoning note.
- **"Not mentioned" handling:** if the contract has no answer, the assistant says so instead of guessing.
- **Polish:** navy and orange design, suggestion chips, typing indicator, clear error messages, and keyboard support (Enter to send, Shift+Enter for a new line).

## Run it locally

1. Download or clone this repository.
2. Double-click `index.html` to open it in your browser (Chrome, Edge or Firefox).

That's it. To use a local web server instead, run `python -m http.server 8000` in the project folder and open <http://localhost:8000>.

## How the webhook works

When you click Send, `app.js` posts a multipart form to the URL in `WEBHOOK_URL` with two fields:

| Field | Content |
| --- | --- |
| `file` | the uploaded PDF |
| `message` | your question |

The webhook must return a JSON object:

```json
{
  "response": "The answer to your question",
  "citation": ["§8.2 exact clause text that supports the answer"],
  "reasoning": "One or two sentences on how the citations support the answer"
}
```

If the answer isn't in the contract, it returns `"This information is not mentioned in the contract."` with an empty `citation` list and empty `reasoning`.

**Notes**
- The n8n workflow must be active, and its webhook node must allow requests from your page (the "Allowed Origins (CORS)" option).
- The webhook URL is visible to anyone who views the page's code. For a public deployment, put a small server in between.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | page structure |
| `styles.css` | layout and styling |
| `app.js` | upload, PDF preview, chat and webhook call |
