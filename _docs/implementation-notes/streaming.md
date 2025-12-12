# Implementation Lessons & Technical Post-Mortem

This document chronicles the challenges, incorrect assumptions, and key learnings discovered while building the **Data Analyst Workspace** using the Google GenAI SDK (`@google/genai`) and Gemini 2.5 Flash.

## 1. Gemini 2.5 "Thinking" & Streaming API

The most significant friction point was handling the new "Thinking" (Reasoning) capabilities in the streaming response.

### The "Thought vs. Text" Ambiguity
**Mistake:** We initially assumed `part.thought` was always a distinct string field separate from `part.text`.
**Reality:** The API behavior is subtle:
1.  In some chunks, `part.thought` is a `string` containing the reasoning.
2.  In others, `part.thought` is a boolean (`true`), indicating that the content in `part.text` *is* the thought.
3.  **Fix:** The streaming loop must check the type of `part.thought`. If `true`, read from `part.text`. If string, read `part.thought`. Furthermore, if a part is flagged as a thought, it must be explicitly skipped for the standard "Text" accumulator to avoid duplication.

### SDK Type Definitions
**Mistake:** We relied on strict Typescript definitions from `@google/genai` which haven't yet fully exposed the `thought` property on the `Part` interface.
**Fix:** We had to use `// @ts-ignore` or explicit casting (`as any`) to access `part.thought`. This is a temporary necessity until the SDK types catch up to the model capabilities.

### Text Getter Concatenation
**Mistake:** Accessing `chunk.text` (the convenience getter) throws errors or warnings when the response contains `functionCall` parts.
**Fix:** We moved to strictly iterating over `chunk.candidates[0].content.parts`. This allows granular handling of `text`, `thought`, and `functionCall` without the SDK trying to merge incompatible types.

## 2. React State & Streaming

### The "Stale Closure" Trap
**Mistake:** In the `while(true)` loop for tool execution, we tried to update the UI using simple `setMessages`. However, rapid stream updates sometimes caused race conditions where state updates overwrote each other or caused flickering.
**Fix:** We implemented a `BlockBased` message structure and a dedicated `updateLastBlock` helper. This helper uses functional state updates (`prev => ...`) to ensure we are always appending to the latest version of the message array, rather than a stale closure capture.

### Optimistic UI
**Mistake:** We waited for the first stream chunk to arrive before adding the "Model" message to the UI. This caused a delay where the UI looked unresponsive after the user clicked "Send".
**Fix:** We switched to **Optimistic UI updates**. We create the Model's message ID and append an empty placeholder message *before* awaiting the API call. This allows the "Thinking..." loading state to appear instantly.

## 3. Pyodide & File System

### Binary vs. String Data
**Mistake:** We tried passing raw `ArrayBuffer` objects from the `FileReader` directly to Pyodide's `FS.writeFile`.
**Reality:** Pyodide's file system expects strings (for text) or `Uint8Array` views (for binary). It throws an "Unsupported data type" error on raw ArrayBuffers.
**Fix:** We added a conversion layer in `hooks/usePyodide.ts` that blindly converts generic buffers to `Uint8Array` before writing.

### Matplotlib "Agg" Backend
**Mistake:** We expected `plt.show()` to just work in a headless browser environment.
**Reality:** Matplotlib defaults to interactive backends (like Tkinter) which crash in WASM.
**Fix:** We had to configure `matplotlib.use("Agg")` (Anti-Grain Geometry, non-interactive) during initialization. To capture images, we check `plt.get_fignums()` after execution, save the figure to an internal buffer, base64 encode it, and pass it back to JS.

## 4. Gemini Files API vs. Local Files

### Context Window Strategy
**Decision:** We adopted a hybrid approach.
1.  **Small Text/Code Files:** Read locally and passed inline to the context.
2.  **Large PDFs/Images:** Uploaded via the Gemini Files API (`files.upload`).
**Gotcha:** The Files API is async. Uploading returns a URI immediately, but the file might be in `PROCESSING` state.
**Fix:** We implemented a polling mechanism in `uploadFileToGemini` that waits for the state to become `ACTIVE` before returning the URI. If we didn't wait, the chat request would fail immediately claiming the file wasn't ready.

## 5. UI/UX: The "Thinking" Block

### Visual Noise
**Mistake:** Initially, thoughts were just another text block. This made the chat history extremely long and hard to parse.
**Fix:** We implemented a `<details>`/`<summary>` based "Reasoning" block.
1.  **Auto-Open:** It defaults to `open={true}` only while `isStreaming` is true.
2.  **Auto-Collapse:** Once the stream finishes, it defaults to closed, keeping the chat history clean while preserving the audit trail of the AI's logic.

## Summary

The combination of **Browser-based Python (Pyodide)** + **Streaming Thoughts (Gemini 2.5)** + **React** creates a powerful but complex state machine. The key to stability was moving away from "magic getters" in the SDK and manually handling the raw data parts, ensuring rigid type conversion at boundaries (JS <-> Python), and using functional state updates for the UI.
