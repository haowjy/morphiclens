# MorphoLens – High-Level Overview

## 1. One-Sentence Pitch

**MorphoLens is an agentic morphometry copilot for biomedical researchers**: you talk to it about your slides and protocols, and it uses Gemini 3 Pro + Gemini Robotics to segment structures, measure them, and interpret the results in context of your experiments—right inside an AI Studio app.

---

## 2. Story & Motivation (WHY)

### 2.1 The real-world pain

A researcher wants to quantify changes in tissue:

* They have **histology slides or μCT images**.
* They open ImageJ / QuPath / other tools and:

  * Manually outline regions of interest.
  * Measure widths, areas, or ratios.
  * Copy numbers into spreadsheets.
* Every new person has to relearn this slow, click-heavy workflow.
  Much of the *knowledge* (what to measure, how to interpret it) lives in **papers and protocols**, while the *work* lives in **pixels and Excel**.

This doesn’t scale well when you have lots of slides, multiple cohorts, and evolving protocols.

### 2.2 The opportunity

Modern Gemini models can:

* Read **protocols and papers**.
* Understand **images**.
* Reason over **numbers and tables**.
* Call tools in an **agentic**, multi-step way.

Gemini Robotics adds **promptable segmentation**: with a single natural language description, it can produce masks for structures in an image.

MorphoLens asks:

> *What if slide morphometry itself became a conversation with an agent that understands your protocol, your images, and your data?*

Instead of:
“Draw boxes on the lateral compartment and type ratios into Excel.”

You say:

> “Using Tang’s OA protocol, analyze this joint and tell me how this GM-/- mouse compares to my WT cohort.”

And the system:

* Reads the protocol,
* Segments the relevant regions using Gemini Robotics,
* Places measurement overlays,
* Computes the indices,
* And explains **what those numbers mean** in the language of your experiment.

---

## 3. What Is MorphoLens? (WHAT)

MorphoLens is a **browser-based AI Studio app** with three main ideas:

1. **Protocol-aware context**

   * Upload key PDFs (e.g., Tang OA paper, lab SOPs).
   * Upload simple CSVs of past experiments (group labels, metrics).
   * MorphoLens learns:

     * Which indices matter,
     * Typical “normal vs diseased” ranges,
     * How cohorts are defined (e.g., WT vs GM-/-).

2. **Interactive slide workspace**

   * Drop in a slide image (histology or μCT).
   * The app uses **Gemini Robotics** to segment named structures from a prompt (e.g., “lateral meniscus, medial meniscus, growth plate cartilage, tibial plateau…”).
   * It overlays masks and simple measurement lines on top of the image.
   * You can drag measurement lines to correct landmarks; metrics update instantly.

3. **Conversational reasoning**

   * A chat panel powered by **Gemini 3 Pro** orchestrates the workflow:

     * Decides which structures to segment and which indices to compute based on the protocol.
     * Reads the new measurements and your CSV cohorts.
     * Explains the results:

       * “Femoral W/L is elevated relative to your control mean; tibial H/W is decreased; this pattern is OA-like and GM-/- appears partially protected.”

The **core experience** is:
**talk → segment → measure → interpret**, in a loop.

---

## 4. Hero Demo: Tang OA Use Case

For the hackathon, we focus on one well-defined story:

1. **Context setup**

   * Upload the Tang OA paper.
   * Upload a CSV summarizing a previous experiment (WT vs GM-/-, treatment vs control).

2. **Single-image analysis**

   * Upload a mouse knee slide image.
   * MorphoLens:

     * Uses Gemini Robotics to detect and segment relevant structures.
     * Draws overlays and measurement lines (e.g., femoral width/length, tibial indices).
     * Computes Tang-style ratios.
     * Uses Gemini 3 Pro to classify the joint as more OA-like or control-like, referencing the protocol and your cohort data.

3. **Human refinement**

   * You tweak a measurement line.
   * Numbers update.
   * You ask: “Reinterpret with the corrected femur width.”
   * The agent updates its explanation accordingly.

This showcases the **agentic loop** without requiring pixel-perfect medical segmentation: Gemini Robotics gives a strong first guess; the human + measurements make it precise enough for the story.

---

## 5. Functional Requirements

### 5.1 Must-have (for the hackathon demo)

1. **Protocol & data ingestion**

   * Upload at least one OA-style PDF.
   * Upload at least one CSV of past experiments.
   * Chat can answer:

     * “Which indices does this protocol use?”
     * “Roughly what values are OA-like vs normal in this dataset?”

2. **Prompt-based segmentation with Gemini Robotics**

   * Given a slide image and a fixed prompt (for a small set of anatomical structures), the app:

     * Calls the **Gemini Robotics model**.
     * Receives masks / bounding boxes and labels for those structures.
     * Draws overlays on the image.

3. **Measurement overlay & basic morphometry**

   * The user can see:

     * The image,
     * Overlaid masks,
     * Measurement lines for 1–3 indices (e.g., femur W/L, tibial ratios).
   * Metrics table shows the computed values.

4. **Gemini-driven interpretation**

   * Given:

     * Protocol context,
     * Measured metrics,
     * CSV cohort summary,
   * Chat produces a short, literate interpretation:

     * Classification (e.g., OA-like vs control-like),
     * Basic comparison to relevant cohort,
     * Clear reference to which indices / thresholds it used.

5. **Light human-in-the-loop**

   * The user can adjust at least one measurement line and request a re-interpretation.
   * The app clearly responds to this change in both numbers and narrative.

### 5.2 Nice-to-have / Stretch

6. **Multiple regions or structures**

   * Support more than one key structure per image (e.g., both lateral and medial compartments, or meniscus + growth plate).

7. **Mini experiment view**

   * Allow a small table with multiple images:

     * One row per sample,
     * Columns for the main indices,
     * Chat can summarize group differences.

8. **Protocol presets**

   * A “Tang OA preset” that:

     * Names the indices and structures,
     * Provides a mini legend (e.g., normal vs OA ranges),
     * Auto-configures the segmentation prompt.

---

## 6. Non-Functional Requirements

For this submission we keep non-functional goals pragmatic and demo-oriented:

1. **AI Studio–first**

   * The whole experience runs as an **AI Studio app**:

     * Gemini 3 Pro for chat + reasoning.
     * Gemini Robotics for segmentation.
   * No external ML stack is required.

2. **Demo stability**

   * The Tang OA flow should work reliably on:

     * A small set of curated images,
     * A reasonable internet connection.
   * Clear loading and error states:

     * If segmentation fails, the app tells the user and degrades gracefully.

3. **Understandability**

   * The UI should make it obvious what is happening:

     * Which structures were segmented,
     * What numbers were computed,
     * How the interpretation connects to the protocol and CSV.

4. **Extensibility**

   * The design should clearly suggest that:

     * You can swap in other protocols (e.g., fibrosis scoring),
     * You can adapt to other modalities (histology, fluorescence, μCT),
     * You could later plug in specialist medical segmenters (e.g., SAM-style models) without changing the core interaction pattern.

---

## 7. Goals vs Reach

### Core Goals (what *must* be true by submission)

* Tell a clear **story**:
  Agentic, conversational morphometry that ties together **protocol → segmentation → measurement → interpretation**.
* Show a **working demo**:

  * Real slide image,
  * Real segmentation via Gemini Robotics,
  * Real numbers computed from the image,
  * Real explanation grounded in protocol and CSV.
* Keep it **self-contained in AI Studio**.

### Reach Goals (great if we have time)

* More polished multi-image experiment view (small table + cohort summary).
* More sophisticated indices (beyond simple widths / heights).
* Simple export (CSV or screenshot of overlays).
* Early hooks for future external segmenters (e.g., SAM-based API) to illustrate the longer-term roadmap.

