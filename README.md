<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/83ac666f-22b9-4cbe-b476-dcaf4bd9dc88

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` to your Gemini API key
3. Run the app:
   `npm run dev`

The Vite server binds to `0.0.0.0:5173` and allows preview hosts, so the UI loads in local and sandboxed environments. The app still boots without an API key; AI generation calls will fail until one is set.

## Open on your phone

Open this on the phone (renders the real app, not source code):

https://htmlpreview.github.io/?https://github.com/afi1982/MIDI-AI-NEW/blob/84b7e833df489502a2373b6259def0b049d6da55/docs/index.html

For a shorter permanent address, enable GitHub Pages:
Settings → Pages → Deploy from branch `arena/01a02d3b-midi-ai-new` / folder `/docs`
then use `https://afi1982.github.io/MIDI-AI-NEW/`

## Install as a mobile app

MIDI AI is a Progressive Web App. On a phone it runs full-screen with a bottom tab bar and can be added to the home screen.

**iPhone / iPad (Safari)**
1. Open the app URL
2. Tap Share
3. Tap **Add to Home Screen**

**Android (Chrome)**
1. Open the app URL
2. Tap the install banner, or menu → **Install app** / **Add to Home screen**

After install it opens like a native app (no browser chrome). Use HTTPS in production so the install prompt and service worker work.
