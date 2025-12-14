# MorphoLens Architecture

Technical deep dive into how MorphoLens works.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Chat UI    │  │   Canvas     │  │   File Browser       │  │
│  │   (React)    │  │   (Layers)   │  │   (IndexedDB)        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────┴─────────────────┴──────────────────────┴───────────┐  │
│  │                    App State (React)                       │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │                 Code-Mode Executor                         │  │
│  │  • Parses `python:run` blocks from Gemini response        │  │
│  │  • Sends code to Pyodide worker                           │  │
│  │  • Scans virtual FS for new artifacts                     │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │              Pyodide Worker (WebAssembly Python)           │  │
│  │  • NumPy, pandas, scikit-image, OpenCV, matplotlib        │  │
│  │  • Role helpers loaded as modules (e.g., `mlens`)         │  │
│  │  • Virtual filesystem: /.session, /workspace/data         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gemini 3 Pro (API)                           │
│  • Multimodal: understands images + text                       │
│  • Generates `python:run` code blocks                          │
│  • Reasons about analysis steps                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code-Mode Execution

MorphoLens uses **code-mode execution** instead of traditional JSON tool calling.

### How It Works

1. **User prompt** is sent to Gemini 3 Pro with conversation history and attached images
2. **Gemini responds** with markdown containing `python:run` code blocks:

```markdown
I'll analyze the growth plate thickness using K-means clustering.

\`\`\`python:run
import mlens
import numpy as np
from sklearn.cluster import KMeans

img = mlens.get_active_image()
# ... analysis code ...
mlens.add_image_layer("Growth Plate Mask", mask_img)
mlens.add_related_plot("Thickness Distribution", fig)
\`\`\`

The analysis shows an average thickness of 142μm.
```

3. **Client parses** the response, extracts `python:run` blocks
4. **Pyodide executes** each block in sequence
5. **Virtual filesystem scanned** for new artifacts (masks, plots, CSVs)
6. **UI updates** with new layers, artifacts, and metrics

### Why Code-Mode?

- **Flexibility**: Gemini can write arbitrary analysis code, not limited to predefined tools
- **Transparency**: Users see exactly what code runs
- **Iteration**: Gemini can adjust code based on intermediate results
- **Visual feedback**: Gemini sees execution results (images, plots) and refines analysis iteratively
- **Scientific stack**: Full access to NumPy, scikit-image, etc.

---

## Pyodide Integration

[Pyodide](https://pyodide.org/) runs CPython in the browser via WebAssembly.

### Packages Available

From `manifest.json`:
```json
{
  "packages": [
    "micropip",
    "numpy",
    "pandas",
    "opencv-python",
    "Pillow",
    "matplotlib",
    "scikit-learn",
    "scipy",
    "scikit-image"
  ]
}
```

Additional packages can be installed at runtime via `micropip`.

### Execution Architecture

Pyodide currently runs on the main thread:

```
App State                      Pyodide Runtime
     │                              │
     │  ──── execute(code) ────►    │
     │                              │  runs Python
     │                              │  writes to virtual FS
     │  ◄──── result/error ─────    │
     │                              │
     │  ──── scan FS changes ───►   │
     │  ◄──── new files ────────    │
```

---

## Virtual Filesystem

Pyodide provides a virtual filesystem for Python code to read/write files.

### Directory Structure

```
/
├── .session/           # Temporary files (cleared on reload)
│   ├── layer_*.png     # Generated mask images
│   ├── artifact_*.png  # Generated plots
│   └── temp_*.csv      # Intermediate data
│
└── workspace/
    └── data/           # Persistent project files
        ├── images/     # User-uploaded images
        └── exports/    # Saved analysis results
```

### File Flow

1. **User uploads** image → stored in IndexedDB, copied to `/workspace/data`
2. **Python generates** mask → saved to `/.session/layer_*.png`
3. **UI scans** `/.session` for new files
4. **Layers rendered** on canvas from the mask files

---

## Canvas & Layer System

The canvas displays images with interactive overlays.

### Layer Types

| Type | Description | Data Format |
|------|-------------|-------------|
| `RASTER` | Image layers (masks, heatmaps) | PNG file path |
| `VECTOR` | Annotations (points, polygons) | JSON array of shapes |

### Adding Layers from Python

```python
import mlens

# Raster layer (mask image)
mlens.add_image_layer("Segmentation Mask", mask_image, opacity=0.5)

# Vector layer (annotations)
annotations = [
    {"type": "point", "x": 100, "y": 200, "label": "Landmark A"},
    {"type": "polygon", "points": [[0,0], [100,0], [100,100], [0,100]]}
]
mlens.add_annotation_layer("Measurements", annotations, color="#ff0000")
```

### Artifact Attachments

Related plots and data can be attached to files:

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots()
ax.hist(measurements, bins=20)
ax.set_xlabel("Thickness (μm)")

mlens.add_related_plot("Thickness Distribution", fig)
```

---

## Local-First Persistence

All state is stored client-side using IndexedDB via [Dexie](https://dexie.org/).

### What's Persisted

- **Threads**: Conversation history with Gemini
- **Files**: Uploaded images and documents
- **Roles**: Installed domain roles
- **Analysis metadata**: Layer data, measurements, artifacts

### Benefits

- Data persists locally; requires network for Gemini API calls
- No backend required (except Gemini API)
- Data stays on user's device
- Survives browser refresh

---

## Role System

Roles package domain-specific functionality. See [role-system.md](./role-system.md) for details.

### Quick Overview

A role is a `.role` folder containing:

```
mlens.role/
├── manifest.json      # Metadata, packages, config
├── prompt.md          # System prompt for Gemini
└── helpers/
    └── mlens.py       # Python module loaded into Pyodide
```

The helper module is exposed as an importable package (e.g., `import mlens`) that provides domain-specific functions for image analysis.
