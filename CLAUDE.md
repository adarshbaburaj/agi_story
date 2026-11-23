# AGI Story (After Hours): hackathon build

Goal: photo of a real table → 3-5 objects become 3D agent characters (bodies built by Gemini) → they plot for 8 beats → ending + poster. Track 01 Film.

Rules
- Speed over perfection. Keep the app runnable after every change; run `npm run build` before saying a task is done.
- Never put API keys in src/. All model and sponsor calls go through /api (server/routes.ts) and server/sponsors/.
- Every sponsor adapter has a live path and a mock; never let one failing sponsor break the film.
- Agents only act through the action list in shared/types.ts and must return strict JSON, validated by shared/validate.ts (falls back to "say").
- Every action must produce visible movement and a DecisionLog entry with "why".
- Never commit .env.

Stack: Vite, React, TypeScript, three, @react-three/fiber, drei, postprocessing, zustand. Gemini (agents + 3D builder), ElevenLabs (voices). Deploy on Vercel.
