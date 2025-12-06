# MorphoLens – High-Level Story & Agentic Capabilities

## 1. One-Sentence Pitch

> **MorphoLens** is an *agentic morphometry copilot* for biomedical researchers: you describe an analysis in chat (“use Tang’s μCT OA indices on this knee and compare to my GM-/- cohort”), and it orchestrates segmentation, geometric measurements, and scientific interpretation across your images, papers, and past data—directly in the browser.

---

## 2. Story & Motivation (WHY)

### 2.1 The real-world pain

A bone biologist wants to quantify OA severity in mouse knees:

* They scan joints with **μCT**.
* Then they spend hours in **Amira / ImageJ**:

  * Manually segmenting bones (thresholds, watershed),
  * Placing tiny ruler endpoints on anatomical landmarks,
  * Copying distances into Excel to compute ratios (e.g., distal femoral width/length, tibial IIOC height/width, as in Tang et al.).
* Every new student has to relearn this dance. It’s slow, brittle, and deeply non-agentic.

The *brain* of the analysis lives in papers and protocols; the *work* lives in clicking and spreadsheets.

### 2.2 The opportunity

Modern LLMs (like **Gemini 3 Pro**) can:

* Read **papers and protocols**,
* Understand **images**,
* Reason about **numbers and tables**,
* And call tools (APIs, functions) in an *agentic* way.

MorphoLens asks:
**What if the morphometry workflow itself became a conversational agent?**

* You give it:

  * Your Tang OA paper / protocol,
  * A few μCT images,
  * Some past CSVs.
* Then you talk to it like you would to a sharp postdoc:

  * “Analyze these knees with Tang’s indices.”
  * “Is my GM-/- mouse protected?”
  * “How do these 28-month-old mice compare to our 10-month controls?”

And instead of just answering in words, it:

* Segments bones,
* Places measurements,
* Computes indices,
* Writes back an explanation *anchored in the literature and your data*.

That’s the core innovation: **chat → agentic capabilities → live morphometry.**

---

## 3. Vision (WHAT we’re building)

### 3.1 Core experience

A **browser-based agentic workspace** with three key surfaces:

1. **Context Panel (“Plan Mode”)**

   * Drag in PDFs (Tang OA, lab SOPs).
   * Drag in past CSVs (previous OA experiments).
   * MorphoLens “reads” this context and remembers key indices, thresholds, and group definitions.

2. **Chat Panel (Brain / Orchestrator)**

   * Conversation with an OA-aware assistant powered by Gemini 3 Pro.
   * You give high-level instructions:

     * “Using the Tang OA paper I uploaded, quantify OA severity on this μCT image.”
     * “Compare this GM-/- MMS mouse to my WT group at 8 weeks.”
   * The agent:

     * Decides when to segment, when to measure, when to summarize, when to ask for clarification.

3. **Canvas Panel (Action Surface)**

   * When you send an image (μCT slice / screenshot from Amira), it opens in a right-side canvas:

     * Shows the original image,
     * Overlays bone segmentations and measurement lines,
     * Displays a small metrics table underneath (distances and ratios).

> For the demo: most of the time you’ll show **Chat + Canvas**, with the Context Panel collapsed after the initial setup.

### 3.2 The “Hero” Tang OA flow

The main story the judges see:

1. **Setup**

   * Upload Tang’s μCT OA paper (or protocol) into the Context Panel.
   * Upload a simple CSV of a previous experiment (WT vs GM-/-, MMS vs control).

2. **Ask**

   * Drag a μCT knee image into chat.
   * Type:

     > “Using Tang’s geometric indices, analyze this joint for OA severity and compare it to my GM-/- cohort.”

3. **Agent acts**

   * Reads Tang’s definitions (femur W/L, tibial IIOC H/W).
   * Calls the segmentation tool (SAM3) to extract femur and tibia contours.
   * Places geometric landmarks (condyle edges, groove midpoint, IIOC height).
   * Computes:

     * Femur width, femur length, W/L ratio.
     * Tibial width, tibial IIOC height, H/W ratio.

4. **Agent shows**

   * Canvas:

     * Original image + overlayed masks.
     * Lines showing femur width & length, tibial height & width.
     * Live metrics table (actual numbers).
   * Chat:

     * A short explanation referencing Tang’s thresholds:

       * “Distal femoral W/L = 1.33 (>1.30 OA-like).”
       * “Tibial IIOC H/W = 0.25 (<0.28 OA-like).”
       * “This pattern matches severe PTOA in WT mice in your protocol. Your GM-/- group shows lower W/L and higher H/W ratios, consistent with partial protection.”

5. **You refine**

   * You nudge a measurement line endpoint on the canvas.
   * Metrics update instantly.
   * You ask: “Reinterpret with the corrected width, please,” and chat updates the narrative.

That’s the **wow**: the agent isn’t just chatting about OA; it’s *doing* OA morphometry with you.

---

## 4. Functional Goals (for the Hackathon)

### 4.1 Must-have for the demo spine

1. **Context ingestion**

   * Upload at least one Tang-like OA PDF.
   * Upload at least one CSV of past OA data.
   * Chat can answer:

     * “Which geometric indices does this paper use to define OA severity?”
     * “What thresholds separate normal vs OA in this protocol?” (even if partially curated).

2. **Single-image Tang OA analysis**

   * Upload a μCT-ish knee image.
   * The app:

     * Shows it on the canvas.
     * Runs a real segmentation pipeline (SAM3 or a constrained heuristic).
     * Places landmarks and computes:

       * Distal femur width, length, W/L.
       * Tibial IIOC height, width, H/W.
   * Displays:

     * Overlays on the canvas,
     * A metrics table under the image.

3. **Gemini interpretation of metrics**

   * Chat sees:

     * The paper context,
     * The metrics JSON,
     * (Optionally) an overlay screenshot.
   * It responds with:

     * A classification (e.g., “OA-like vs control-like”),
     * Citations to specific indices and their thresholds,
     * A short explanation comparing to the uploaded CSV.

4. **Light human-in-the-loop**

   * At minimum:

     * You can drag a measurement line and recompute numbers.
   * The demo can show:

     * “I corrected the femur width slightly; the ratio dropped but still sits in the OA range.”

### 4.2 Nice-to-have (if time permits)

5. **Tang OA preset**

   * A preset button that:

     * Names the indices (Femur W/L, Tibia H/W),
     * Shows a tiny legend (normal vs OA band),
     * Applies this measurement recipe to any new image you feed it.

6. **Mini experiment table**

   * Let the user:

     * Add multiple samples (WT, GM-/-, aged).
     * See rows of indices.
   * Have chat:

     * Summarize group differences,
     * Suggest simple interpretations.

---

## 5. Non-Functional Goals (for this weekend)

We keep these minimal and pragmatic:

* **Browser-first**

  * The entire demo runs in a browser (using AI Studio + front-end code).
  * Heavy lifting:

    * Gemini for reasoning & multimodality,
    * SAM3 API for segmentation,
    * Simple JS (or Pyodide later) for geometry.

* **Demo-stable**

  * The Tang OA path (one or a few curated images) must work consistently:

    * No brittle multi-step flows,
    * Clear loading states and error messages.

* **Obvious wow**

  * From a judge’s point of view, it should be crystal-clear that:

    * The app is using Gemini to read real text (paper/protocol),
    * Understand real images (μCT slice),
    * Compute real numbers (indices),
    * And tie them together in a scientific explanation.

---

## 6. Future Directions (where “Trust by Visibility” lives)

We *won’t* emphasize this in the hackathon demo, but it’s nice to mention in the writeup as **future work**:

* **Versioned measurement recipes**

  * Tang OA as `tang_oa_v1.0`, with full provenance.
* **Deeper trust/visibility**

  * Click an index → see formula + landmarks + mask.
  * Export JSON recipes + logs for full reproducibility.
* **Benchmarking**

  * Compare MorphoLens indices to manual Amira measurements across multiple raters.
* **More agent specializations**

  * Separate “canvas agent” (segmentation + prompts),
  * “image-calc agent” (geometry & stats),
  * “insight agent” (study design & interpretation).

These are great to talk about as **next steps**, not something you need to fully implement or show to win *this* weekend.
