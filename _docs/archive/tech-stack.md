# MorphoLens – Technology Choices (What & Why)

## 0. Goals That Drive the Stack

We’re optimizing for:

1. **Browser-only, no backend**
   Everything must run inside an AI Studio app: no custom servers, no secret-proxy hacks.

2. **Real, agentic capabilities – not a fake demo**

   * Actual image segmentation / detection
   * Actual geometry & stats on real data
   * Actual protocol understanding from PDFs

3. **SOLID & extendable**
   We want clean boundaries so:

   * We can swap models or add workflows later.
   * We don’t end up with “spaghetti LLM in the UI”.

4. **Polished UX with minimal extra dependencies**
   Focus on a few high-leverage libraries instead of a big framework soup.

---

## 1. Frontend Framework & State

### 1.1 React + TypeScript

**What**

* React (function components + hooks)
* TypeScript across the app

**Why**

* AI Studio already assumes React; no friction.
* TS gives strong types for:

  * Domain objects (`WorkspaceFile`, `TangIndices`, `ImageAnalysisResult`)
  * Service interfaces (`LlmService`, `VisionService`, `PythonService`)
  * Tool IO (validated with Zod, see below)
* React is more than enough for a 3-pane layout + canvas.

**Used for**

* Layout: `ChatPane | FilePane | WorkSurface`
* WorkSurface views: `ImageCanvasView`, `DocView`, `DataView`, `NotesView`
* Chat UI & message cards
* Tool progress indicators, buttons, toggles, etc.

---

### 1.2 React Context + Reducer (App State)

**What**

* A single `AppState` + `AppReducer`, exposed via `AppStateProvider` + hooks:

  * `useAppState()`
  * `useAppDispatch()`

**Why**

* Simple, explicit, SOLID:

  * Components depend on *interfaces* (`useAppState`, `useAppDispatch`), not the implementation.
  * Easy to reason about how state changes (all mutations via `AppAction`).
* We already have TanStack Query for async/remote state, so another state library is overkill.
* Easier to debug than scattering state across many contexts or atoms.

**Examples of what lives here**

```ts
interface AppState {
  files: WorkspaceFile[];
  activeFileId: string | null;
  layouts: {
    chatCollapsed: boolean;
    filesCollapsed: boolean;
    canvasFullscreen: boolean;
  };
  overlaysByImageId: Record<string, SegmentationOverlay[]>;
  metricsByImageId: Record<string, TangIndices>;
  chatMessages: ChatMessage[];
}
```

* All purely “our app’s world”, no network or model logic.

---

### 1.3 TanStack Query

**What**

* TanStack Query (`@tanstack/react-query`) for async workflows:

  * `useMutation` / `useQuery`

**Why**

* Handles all *RPC-like* operations:

  * Gemini calls (chat, segmentation, document extraction)
  * Pyodide Python computations
* We get:

  * Loading/error states “for free”
  * Retry behaviors
  * Cache for repeated operations
* Keeps async logic out of components and out of the reducer.

**Used for**

* `useSegmentImage()` → calls Vision service, then dispatches `SET_OVERLAYS`
* `useComputeTangIndices()` → calls Python service, then dispatches `SET_METRICS`
* `useExtractWorkflowFromDocs()` → calls LLM, then stores “Tang OA workflow”
* `useSummarizeCohort()` → runs Python + LLM, then appends an assistant chat message

---

## 2. AI / LLM & Vision Layer

### 2.1 Google GenAI JavaScript SDK (`@google/genai`)

**What**

* Official Google SDK for Gemini models and Files API.

**Why**

* AI Studio native.
* Simplifies:

  * Sending images + prompts to Gemini 2.5 (object detection & segmentation).
  * Chatting with Gemini 3 Pro.
  * Uploading and referencing files via `file_uri` (no custom storage).

**Used for**

* `LlmService` implementation (chat, tool use).
* `VisionService` implementation (segmentation / bounding boxes).
* `FilesService` implementation (uploading PDFs/images/CSVs).

---

### 2.2 Gemini 3 Pro (Reasoning / Research Brain)

**What**

* Main LLM for:

  * Protocol understanding
  * Agentic tool orchestration
  * Narrative explanations

**Why**

* Strong reasoning and multimodality.
* Handles:

  * Reading Tang-like papers and SOPs.
  * Turning them into structured workflows (indices, thresholds).
  * Explaining how indices map to “OA-like vs normal”.
  * Creating human-readable summaries and cohort interpretations.

**Used for**

* “Research copilot” chat.
* Extracting measurement definitions (Tang indices) from documents.
* Summarizing metrics: “Is this knee OA-like?”; “Compare WT vs GM-/-”.

---

### 2.3 Gemini 2.5 Flash (Vision – Segmentation & Detection)

**What**

* Gemini 2.5 Flash with the newer **image understanding** APIs:

  * Object detection (bounding boxes)
  * Segmentation (masks + base64 PNGs)

**Why**

* Explicitly trained to do object detection + segmentation.
* Works with:

  * Normalized coordinates `[0–1000]`
  * Masks encoded as base64 probability maps
* Let’s us do segmentation without a separate model like SAM3, while staying entirely within Gemini / AI Studio.

**Used for**

* Segmentation of:

  * Femur, tibia, joint regions, maybe meniscus.
* Producing:

  * `box_2d` arrays (normalized)
  * Segmentation masks (`mask` base64 PNG)
* Feeding masks to the measurement layer (Python) to compute indices.

---

## 3. Data & Analysis Engine

### 3.1 Pyodide (Python in the Browser)

**What**

* Pyodide runtime loaded via CDN in the browser.
* Python packages:

  * `numpy`
  * `pandas`
  * (Optional) `matplotlib` if we want Python-side plots.

**Why**

* Gives us a **real scientific computing stack** without a backend:

  * LLMs are not great at operating over arbitrary numeric tables.
  * Python + pandas is the established workflow in science.
* “Wow” factor:

  * We can show: “LLM → segmentation → Python code → indices & stats”, all in-browser.
* Keeps geometry and statistics:

  * Deterministic
  * Testable
  * Separate from LLM hallucinations

**Used for**

* Turning segmentation masks + pixel spacing into:

  * Femur width & length
  * Tibial IIOC width & height
  * Ratios (W/L, H/W)
* Running cohort-level analysis on CSVs:

  * Group-by operations
  * Means, confidence intervals, etc.
* Optionally: generating summary tables/plots that React renders.

---

### 3.2 Zod (Schemas for Tool IO)

**What**

* Zod for runtime schema validation and inferred TS types.

**Why**

* We have several structured payloads:

  * `SegmentationMask[]` from Gemini 2.5
  * `TangIndices` from Python
  * `ImageAnalysisResult`, `CohortSummary` from Python+LLM tools
* Zod allows us to:

  * Validate LLM tool outputs and Python JSON before trusting them.
  * Use the same schema for:

    * Types in TS (`z.infer<typeof TangIndicesSchema>`)
    * Validation in runtime.

**Used for**

* Validating:

  * Segmentation results from Gemini.
  * JSON payloads returned from Pyodide.
* Making the agent/tool calls more robust and less brittle.

---

## 4. Visualization & UI Utilities

### 4.1 HTML Canvas (Image + Overlays)

**What**

* Native `<canvas>` element driven by React for:

  * Base image
  * Masks
  * Overlays (boxes, points, measurement lines)

**Why**

* Lightweight, flexible, no heavy canvas framework required.
* Fine-grained control over:

  * How segmentation masks are rendered and colored.
  * Drawing measurement lines + labels.
* Easy to implement zoom/pan on a single-pane canvas.

**Used for**

* The right-hand **Canvas / Work Surface** for images:

  * Show μCT slice.
  * Overlay segmentation masks.
  * Draw bounding boxes & points.
  * Draw measurement axes and labels.

---

### 4.2 Recharts (Charts & Cohort Visuals)

**What**

* Recharts for quick, declarative charts in React.

**Why**

* Low code overhead; great for demos.
* Integrates well with structured metrics from Python.

**Used for**

* Per-cohort bar/box plots for Tang indices:

  * Femur W/L by group
  * Tibial H/W by group
* Small inline charts in “analysis cards” inside chat or the Work Surface.

---

### 4.3 `react-markdown` (Markdown Rendering)

**What**

* A React component to render markdown safely.

**Why**

* Gemini replies are often markdown (lists, bold text, headings).
* Our own notes may be markdown (`notes.md` files).
* Keeps things clean without building our own renderer.

**Used for**

* Rendering assistant messages in chat.
* Viewing in-app notes (markdown files).
* Simple doc views for internal workflow notes.

---

### 4.4 `react-resizable-panels` (Pane Layout)

**What**

* A small library to create resizable split panels.

**Why**

* Our global layout is:

  * Chat (left)
  * Files (thin middle)
  * Work Surface (right)
* Resizable panes:

  * Make the UI feel “pro” with very little code.
  * Let users give more space to canvas or chat as needed.

**Used for**

* The main `[Chat] | [Files] | [Work Surface]` layout.
* Potentially to resize a metrics area under the canvas.

---

## 5. File & Document Handling

### 5.1 Gemini Files API

**What**

* Uploads and references files via `file_uri`.

**Why**

* No custom storage or backend needed.
* LLM can work on large PDFs / images without Base64 overload.
* Re-use of files across multiple prompts and tools.

**Used for**

* Uploading:

  * Tang-like OA papers / protocols
  * CSV datasets
  * Large image files
* Providing those files as context to Gemini 3 Pro for:

  * Workflow extraction
  * Citation-backed explanations

---

## 6. Styling & Misc

### 6.1 CSS / Minimal Utility

**What**

* Simple CSS modules or a single global stylesheet.
* Optionally a tiny helper like `clsx` / `classnames`.

**Why**

* We don’t need a full design system to impress judges.
* Faster to keep styling light and targeted:

  * Layout
  * Panel borders
  * Buttons, toggles, icons
* Leaves room to focus effort on the “wow” behaviors (agentic workflows, canvas, Python lab).

---

## 7. What We’re *Not* Using (And Why)

### 7.1 No Jotai / Redux / Zustand

* We already have:

  * **React context + reducer** for app state.
  * **TanStack Query** for async/remote state.
* Adding another state layer would increase cognitive load without real benefit for this app size.

### 7.2 No CopilotKit

* CopilotKit is powerful but:

  * Opinionated about layout and agent flows.
  * Redundant with AI Studio + our own agent design.
* We instead:

  * Steal the **UX patterns** (inline cards, tool traces),
  * Implement them with our own state + components.

### 7.3 No Separate Segmentation Backend (SAM3)

* For this hackathon:

  * We want an **all-Gemini, all-AI-Studio** story.
  * Gemini 2.5’s segmentation support is enough to demonstrate the concept.
* SAM3 (with point-based control) is a great future direction, but would require:

  * A separate backend or heavy client lib.
  * More infra than we want in a browser-only AI Studio app.

---

## 8. Summary

In one sentence:

> **MorphoLens uses React + TS + TanStack Query + context/reducer for UI, Gemini 3 Pro + 2.5 Flash for multimodal reasoning & segmentation, Pyodide + pandas for real morphometry, and a lightweight canvas + charts stack to visualize everything — all running fully in the browser, no backend required.**

