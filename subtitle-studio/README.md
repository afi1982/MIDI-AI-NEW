# Subtitle Studio (Standalone)

A fully separate, mobile-first app for:
- Audio/video transcription
- Subtitle translation to any language
- Cue timing/text editing
- TikTok-style subtitle design preview
- Export to SRT / VTT / JSON

## Run

1. Install:
   - `npm install`
2. Create `.env.local` in this folder:
   - `VITE_GEMINI_API_KEY=your_key_here`
3. Start:
   - `npm run dev`

## Notes

- This app is intentionally **independent** from the MIDI AI application.
- It lives under `subtitle-studio/` and does not modify the MIDI UI flow.
