import { claudeAdapter } from "./claude.js";
import { codexAdapter } from "./codex.js";
import { continueAdapter } from "./continue.js";
import { copilotAdapter } from "./copilot.js";
import { droidAdapter } from "./droid.js";
import { fxAdapter } from "./fx.js";
import { geminiAdapter } from "./gemini.js";
import { grokAdapter } from "./grok.js";
import { hermesAdapter } from "./hermes.js";
import { kimiAdapter } from "./kimi.js";
import { ompAdapter } from "./omp.js";
import { opencodeAdapter } from "./opencode.js";
import { piAdapter } from "./pi.js";

export const adapters = [
  codexAdapter,
  claudeAdapter,
  piAdapter,
  ompAdapter,
  hermesAdapter,
  kimiAdapter,
  grokAdapter,
  copilotAdapter,
  continueAdapter,
  opencodeAdapter,
  geminiAdapter,
  droidAdapter,
  fxAdapter,
];
