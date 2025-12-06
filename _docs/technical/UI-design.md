# MorphoLens – UI / UX Design Doc

## 1. Philosophy

### 1.1 Agent-first, not menu-first

* The *primary* control surface is **chat**, not toolbars.
* User mental model:

  > “I talk to the copilot → it opens/acts on things → I see the result.”
* Menus and buttons exist, but they’re secondary shortcuts to what you can already ask for in chat.

### 1.2 Workspace, not single view

* MorphoLens is a **workspace with files**, not a magical black-box chat.
* Everything lives as a **file**:

  * Images (slides, μCT snapshots)
  * Papers / protocols (PDF, docx, markdown, LaTeX)
  * Datasets (CSV)
  * Notes (markdown created in-app)
* The app always answers: “What file am I working on right now?”

### 1.3 Human-in-the-loop morphometry

* The system should *show its work*:

  * Visible segmentations, boxes, points, metrics tables.
  * Humans can refine masks / lines and re-run analysis.
* No magic “OA score = 7.3” with no visible steps.

### 1.4 Minimal chrome, maximal canvas

* Default layout uses **three panes**, but every non-essential panel can be collapsed.
* Goal: when looking at an image, the user should feel like “most of my screen is the data, not UI.”

---

## 2. Global Layout

Default desktop layout (L → R):

```text
[ Chat / Copilot ]   [ Files ]         [ Work Surface ]
(Left, ~30–35%)      (Thin, ~15%)      (Right, ~50–55%)
```

* **Chat Pane (left)** – conversational control, history of agent actions.
* **File Pane (middle, narrow)** – workspace file list and quick selection.
* **Work Surface (right)** – the thing being acted on:

  * Image canvas, or
  * Document viewer, or
  * Data preview / plots.

### 2.1 Modes (conceptual)

We still talk about **Plan vs Analysis**, but they’re driven by *what’s in the Work Surface*:

* **Plan Mode**

  * Work Surface shows: docs, CSVs, notes.
  * Used to encode workflows, inspect datasets, review protocols.
* **Analysis Mode**

  * Work Surface shows: image canvas + overlays + metrics.
  * Used for segmentation, measurement, and per-sample analysis.

No separate “mode switch” button is required; opening an image implicitly looks and feels like “Analysis”.

---

## 3. Panel Details & Collapse Behavior

### 3.1 Chat Pane (Left)

**Content**

* Conversation with the copilot.
* System messages about what tools were called:

  * “Loaded Tang_OA.pdf”
  * “Segmented femur/tibia on knee_mct_01.png”
  * “Ran Python analysis on gmko_experiment.csv”
* Optional small toolbar:

  * Model selector (Gemini 3 Pro vs 2.5 Flash for some tools).
  * Temperature / thinking toggle.

**Interactions**

* User instructions: “Open the Tang paper”, “Analyze this image with Tang OA indices”, “Summarize the cohort differences”, etc.
* Agent can reference the **currently active file** on the Work Surface.

**Collapse behavior**

* **Collapse to slim rail**:

  * Shows an icon (e.g., 💬) with unread badge when new messages arrive.
  * Hover or click slides the pane out temporarily.
* In **Canvas fullscreen**:

  * Chat is either:

    * Hidden entirely with a “Back to chat” button, or
    * Reduced to a small overlay icon in the corner.

---

### 3.2 File Pane (Middle, narrow)

**Content**

* Vertical list (or grouped sections) for workspace files:

  * Images
  * Documents
  * Datasets
  * Notes
* Each file entry:

  * Name, type icon, small status (e.g. “Loaded in Python”, “Used in Tang OA workflow”).

**Interactions**

* Click file:

  * Sets `activeFileId`.
  * Updates **Work Surface**:

    * Image → Canvas
    * PDF/docx/md/tex → Doc viewer
    * CSV → Data preview
    * Note → Markdown editor/view
* Right-click / contextual menu (stretch goal):

  * “Rename”, “Delete”, “Open in new window”, etc.

**Collapse behavior**

* **Collapse to icon strip**:

  * Only shows file-type icons (🖼, 📄, 📊, 📝) stacked vertically.
  * Hover expands to full width.
* In Canvas fullscreen:

  * Typically hidden; toggled via a small “Files” button or keyboard shortcut.

---

### 3.3 Work Surface (Right)

This is the heavy panel. It changes depending on `activeFile.kind`.

#### 3.3.1 Images → Canvas

**Content**

* Main image viewer:

  * Zoom, pan, brightness/contrast (if time).
* Overlays:

  * Segmentation masks (color-coded).
  * Annotations (points, boxes, freehand strokes).
  * Measurement glyphs (distance lines, angle markers).
* Metrics area:

  * Small table under the image with key indices (e.g., femur W/L, tibia H/W).
* Optional “Analysis Lab” section:

  * Pyodide outputs (plots, summary stats) associated with this image/cohort.

**Collapse / toggle behavior**

* Overlay controls:

  * Per-layer eye icons to hide/show masks, points, lines.
* Metrics:

  * Metrics area can be collapsed to a single line (e.g., “Femur W/L 1.33, Tibia H/W 0.25 — OA-like”) with a chevron to expand the full table.
* **Fullscreen**:

  * Canvas expands to occupy the entire main area.
  * Chat + Files panes hidden or minimized.
  * Exit via ESC or 🔲 icon.

#### 3.3.2 Documents (PDF, docx, markdown, tex)

**Content**

* Scrollable, readable document:

  * PDF embed or simplified text view.
  * Markdown rendered as rich text.
* Small header showing:

  * Name, type, page x/y, “Summarize / Extract protocol” actions.

**Collapse behavior**

* Document viewer itself doesn’t collapse, but:

  * Secondary info (like “document metadata” or “extracted workflow summary”) can be a collapsible side or bottom strip.

#### 3.3.3 Datasets (CSV)

**Content**

* Data preview:

  * First N rows in a table.
  * Column list with quick type inference (numeric, categorical).
* Status area:

  * “Loaded into Python as `df_experiment`.”
  * Quick actions: “Describe dataset”, “Group by…”.

**Collapse behavior**

* Preview table can collapse to:

  * “Showing 10/500 rows, 12 columns – click to expand.”
* The Pyodide ‘lab’ output (plots, derived tables) can be a separate collapsible panel at the bottom of the Work Surface.

#### 3.3.4 Notes (markdown created in app)

**Content**

* Split view (optional):

  * Left: markdown editor.
  * Right: rendered preview.
* Or simple editor if time is short.

**Collapse behavior**

* Editor toolbar can be minimal or collapsible to keep focus on text.
* If we do split view, preview pane can be toggled off.

---

## 4. Responsiveness

### 4.1 Desktop (hackathon target)

* Three-pane layout is primary.
* Resizable gutters between panes (drag to adjust width).
* Fullscreen canvas mode for image work.

### 4.2 Smaller widths (optional / stretch)

* Collapse File pane by default.
* Stack layout:

  ```text
  [Chat] / [Work Surface]
  [Files toggle button]
  ```

But mobile optimization is not required for the hackathon demo.

---

## 5. Key UX Flows & How UI Supports Them

### 5.1 “Upload and understand my protocols”

* User drops PDFs into Files → they appear in File Pane.
* Chat: “Summarize Tang’s OA indices from my protocols.”
* Agent:

  * Calls `list_files` to find relevant docs.
  * Opens one in Work Surface (doc viewer).
  * Responds in Chat with bullet summary.
* User can keep reading the doc in Work Surface while chatting.

### 5.2 “Analyze this image”

* User clicks image file (or drags an image into Chat).
* Work Surface → Canvas view.
* Chat: “Analyze OA severity using Tang workflow.”
* Agent:

  * Runs segmentation + measurement.
  * Updates Canvas overlays & metrics.
  * Explains results in Chat.

### 5.3 “Fix the segmentation, recompute”

* User in Canvas:

  * Enters “Refine” mode (toggle in Canvas toolbar).
  * Adds positive/negative points, adjusts bounding boxes.
* Click “Recompute metrics” or say it in Chat.
* Metrics table + explanation updates.

### 5.4 “Cohort comparison”

* User has multiple images / CSV loaded.
* Chat: “Compare GM-/- vs WT using Tang indices.”
* Agent:

  * Uses Pyodide to aggregate metrics.
  * Shows summary table / simple plot in Work Surface.
  * Explains interpretation in Chat.
* Data preview / plot area can be collapsed if user just wants the narrative.

---

## 6. Things That Can Be Collapsed (Summary)

* **Chat pane**

  * Collapse to a rail; optional overlay only in fullscreen.
* **File pane**

  * Collapse to thin icon strip.
* **Canvas overlays**

  * Per-layer visibility toggles (masks, boxes, points, measurement lines).
* **Metrics table**

  * Collapse to single-line summary.
* **Pyodide / Analysis lab outputs**

  * Collapsible sub-panel under the main image/preview.
* **Document secondary info**

  * Workflow summary / metadata panel collapsible.
