# MorphoLens

**Conversational AI for scientific image analysis—no software licenses, no learning curve**

[Try it](https://ai.studio/apps/drive/1Y1nzIDAYnccpQ-GC10SNBvpMoPPwNG-7?fullscreenApplet=true) | [Watch demo](https://youtu.be/6ffNdKhx4wQ) | [Kaggle Writeup](https://www.kaggle.com/competitions/gemini-3/writeups/new-writeup-1765535914340)

---

## What is MorphoLens?

MorphoLens is a conversational AI workspace for scientific image analysis. Researchers describe what they want to measure in plain language, and Gemini 3 Pro does the rest—understanding images, generating analysis code, and producing publication-ready measurements.

Built in Google AI Studio's Build environment using Gemini 3 Pro, then extended with a browser-based Python stack (Pyodide) and React.

## Key Capabilities

- **Natural language analysis**: Describe measurements conversationally ("measure the width between these bone landmarks")
- **Browser-native Python**: Full scientific stack (NumPy, scikit-image, OpenCV) runs entirely in-browser via Pyodide
- **Interactive canvas**: Point to structures for precise guidance, view results overlaid on images
- **Role system**: Domain protocols packaged as shareable modules for reproducible workflows
- **Zero setup**: No installation, no backend, no software licenses

## How It Works

```
User describes task → Gemini 3 Pro reasons + generates code → Pyodide executes → Results rendered on canvas
```

1. **Gemini 3 Pro** interprets the request and generates `python:run` code blocks
2. **Pyodide** executes Python code in the browser with a virtual filesystem
3. **Canvas** renders masks, plots, and measurements as interactive layers
4. **Role system** provides domain-specific prompts and helper functions

## Documentation

- [Architecture](./architecture.md) - Technical deep dive into the system
- [Role System](./role-system.md) - How to create and use domain roles
- [Hackathon Writeup](./hackathon-writeup.md) - Full project writeup with references

## Technical Summary

| Component | Implementation |
|-----------|----------------|
| LLM | Gemini 3 Pro (multimodal) |
| Runtime | Pyodide (WebAssembly Python) |
| Tool System | Code-mode (`python:run` blocks), not JSON tool calling |
| Interaction | Interactive canvas (human-in-the-loop) |
| Extensibility | Role system (`.role` bundles) |
| State | Dexie-backed IndexedDB (local-first) |
| UI | React |
