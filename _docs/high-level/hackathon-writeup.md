# MorphoLens

**Conversational AI for scientific image analysis—no software licenses, no learning curve**

[Try it](https://ai.studio/apps/drive/1Y1nzIDAYnccpQ-GC10SNBvpMoPPwNG-7?fullscreenApplet=true) | [Watch demo](https://youtu.be/6ffNdKhx4wQ)

---

## The Problem

Quantitative image analysis is fundamental to biomedical research, yet access remains limited by:

1. **Expensive software**: Commercial tools like HALO, Visiopharm, and Imaris require enterprise licensing—pricing is quote-based and typically requires institutional budgets
2. **Steep learning curves**: Even with software access, researchers often spend months learning specialized interfaces before becoming productive
3. **Protocol lock-in**: Methods developed in one tool don't transfer—knowledge stays siloed within platforms
4. **Accessibility gaps**: Labs in underfunded institutions or developing regions face compounding barriers

Open-source tools like ImageJ/Fiji have helped democratize basic analysis, but advanced quantitative workflows still require significant expertise.

## The Solution

MorphoLens is a conversational AI workspace for scientific image analysis that I built. Instead of learning complex software, researchers describe what they want to measure in natural language. Gemini 3 Pro interprets the request, understands the image, generates appropriate analysis code, and returns results—all in the browser.

**Key capabilities:**
- Load images directly (drag-and-drop or file browser)
- Describe measurements conversationally ("measure the width between these bone landmarks")
- Point to structures on an interactive canvas for precise guidance
- View results overlaid on the image
- Export data for publication

Under the hood, I treat Gemini as the planner and Pyodide as the execution engine: Gemini proposes `python:run` code blocks, I execute them in a persistent browser-based Python workspace, scan the virtual filesystem for new masks, plots, or CSVs, and immediately reflect them back as layers, artifacts, and metrics on the image.

## Demo Walkthrough

The video demonstrates MorphoLens analyzing a histology section to measure growth plate thickness for osteoporosis evaluation:

1. **Load image**: A stained tissue section showing the growth plate region
2. **Describe task**: "Measure the thickness of the growth plate"
3. **AI reasoning**: Gemini 3 Pro identifies the growth plate and generates K-means clustering code for thickness analysis
4. **Results**: Overlay visualization with thickness measurements (average and max) for evaluating osteoporosis progression

This analysis—previously requiring manual annotation or specialized training—now runs through natural conversation.

## Impact

**Immediate:**
- Researchers without software budgets can perform quantitative analysis
- Published protocols become executable, not just readable
- Learning curve drops from months to minutes

**Future:**
- Protocol marketplace: researchers share domain roles
- Reproducibility: same role = same analysis with same equations
- Education: students learn by describing, not clicking

**Beyond biomedical:**
The architecture is domain-agnostic. Any analytical workflow that can be expressed as "look at this, measure that" can become a role:
- Materials science (grain analysis, defect detection)
- Geospatial (land use classification, change detection)
- Audio (waveform analysis, spectral measurements)

## How It Works

- **Gemini 3 Pro multimodal reasoning** — takes the chat history plus attached images/annotations and plans analysis steps.
- **Code-mode execution (`python:run`)** — instead of calling JSON tools, Gemini writes `python:run` blocks; the client extracts those blocks and executes them inside Pyodide, then streams results back into the conversation.
- **Browser-native Python (Pyodide)** — runs a full scientific stack (NumPy, pandas, scikit-image, OpenCV, matplotlib) entirely in the browser, with a virtual filesystem that separates temporary session files (`/.session`) from persistent project data (`/workspace/data`).
- **Role system** — domain protocols are packaged as `.role` bundles (manifest + prompt + Python helpers). MorphoLens loads them into Pyodide and exposes them as the `mlens` library for biomedical imaging.
- **Local-first persistence** — a Dexie-backed IndexedDB database stores threads, roles, files, and analysis metadata so work survives reloads with no backend.
- **Human-in-the-loop canvas** — I let users click to mark landmarks; the Python layer writes masks, plots, and metrics into the virtual workspace, and the UI turns them into layers, artifacts, and overlays on top of the original image.

---

## Technical Summary

| Component | Implementation |
|-----------|----------------|
| LLM | Gemini 3 Pro (multimodal) |
| Runtime | Pyodide (WebAssembly Python) + virtual FS (/.session, /workspace/data) |
| Tool System | Python-native (not JSON tool calling) |
| Execution | Code-mode (````python:run```` format), client-side parsing of blocks |
| Interaction | Interactive canvas (human-in-the-loop) |
| Extensibility | Role system (`.role` bundles: manifest + prompt + helpers) |
| State | Dexie-backed local DB (threads, files, roles, metadata) |
| UI | React, runs entirely in browser |

---

## References

1. Isensee et al. (2022). [Open-Source Biomedical Image Analysis Models: A Meta-Analysis](https://www.frontiersin.org/journals/bioinformatics/articles/10.3389/fbinf.2022.912809/full). *Frontiers in Bioinformatics*. — Documents how open-source tools enabled "research groups without image analysis specialists" to perform quantitative analysis.

2. Mount Sinai (2025). [Powerful New Software Platform Could Reshape Biomedical Research](https://www.mountsinai.org/about/newsroom/2025/powerful-new-software-platform-could-reshape-biomedical-research-by-making-data-analysis-more-accessible). — Discusses accessibility barriers and removing "a major barrier to data-driven discovery."

3. [QuPath vs HALO vs Visiopharm discussion](https://forum.image.sc/t/qupath-vs-halo-vs-visiopharm/45310). *Image.sc Forum*. — Community discussion on commercial vs. open-source image analysis tools.
