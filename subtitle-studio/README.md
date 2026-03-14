# Subtitle Studio (Standalone)

A fully separate, mobile-first + desktop-ready app for:
- Audio/video transcription
- Subtitle translation to any language
- Multi-file batch queue processing
- Cue timing/text editing
- TikTok-style subtitle design preview
- Subtitle import (SRT / VTT / JSON)
- Export to SRT / VTT / CSV / JSON
- Readability quality scoring + timing auto-fix
- Session auto-recovery from local storage

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
