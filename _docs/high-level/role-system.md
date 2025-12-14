# Role System

Roles package domain-specific prompts and Python helpers into shareable modules. This enables reproducible analysis workflows without code changes—different domains just use different roles.

---

## Role Bundle Structure

A role is a folder with a `.role` extension containing:

```
example.role/
├── manifest.json      # Metadata and configuration
├── prompt.md          # System prompt for Gemini
└── helpers/
    └── example.py     # Python module loaded into Pyodide
```

---

## manifest.json

Defines the role's metadata, dependencies, and capabilities.

```json
{
  "id": "biomedical",
  "name": "MorphoLens (Bio)",
  "description": "Advanced biomedical image analysis and annotation.",
  "version": "1.0.0",
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
  ],
  "helpers": [
    "mlens.py"
  ],
  "artifactTypes": [
    "image",
    "layer",
    "data"
  ],
  "thinkingBudget": 32768
}
```

### Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the role |
| `name` | Display name |
| `description` | Short description of capabilities |
| `version` | Semantic version |
| `packages` | Python packages to install via micropip |
| `helpers` | Python files to load as modules |
| `artifactTypes` | Types of artifacts this role can produce |
| `thinkingBudget` | Token budget for Gemini reasoning |

---

## prompt.md

System prompt that instructs Gemini how to behave and what APIs are available.

```markdown
You are MorphoLens (Bio), an advanced scientific morphometry assistant.

DOMAIN API ('import mlens'):
- `mlens.load_image(filename)` -> PIL.Image
- `mlens.get_active_image()` -> PIL.Image
- `mlens.add_image_layer(name, image, opacity)`: Add a raster layer
- `mlens.add_annotation_layer(name, list_of_dicts, color)`: Add vector annotations
- `mlens.add_related_plot(name, figure)`: Attach a matplotlib figure
- `mlens.report_layer_data(layer_name, blocks)`: Report structured data
- `await mlens.install_package(name)`: Install PyPI packages

Your goal is to help users analyze images, create masks, calculate metrics, and visualize data.
Use 'mlens' for all domain-specific tasks.
```

---

## Helper Module

Python code that gets loaded into Pyodide and exposed as an importable module.

### Core Pattern

```python
import core
import sys
import types
from PIL import Image

class MyDomainHelper:
    def load_image(self, filename):
        # Implementation
        pass

    def add_image_layer(self, name, data, **style):
        # Queue action for UI
        core._core_actions.append({
            "type": "add_layer",
            "name": name,
            "layer_type": "RASTER",
            "source": "/path/to/saved/image.png",
            "style": style
        })
        return f"Added layer '{name}'"

# Create module and register
_impl = MyDomainHelper()
my_module = types.ModuleType("mydomain")
for attr in dir(_impl):
    if not attr.startswith("_"):
        setattr(my_module, attr, getattr(_impl, attr))
sys.modules["mydomain"] = my_module
```

### The `core` Module

Helpers interact with the UI through a `core` module that provides:

- `core.list_files()` - List available files
- `core.get_active_file()` - Get currently selected file
- `core.save_file(filename)` - Save to project
- `core.install_package(name)` - Install PyPI package
- `core._core_actions` - Queue of actions for UI to process

---

## mlens API Reference

The biomedical role (`mlens.role`) exposes these functions:

### Image Loading

```python
mlens.load_image(filename: str) -> PIL.Image
```
Load an image by filename. Searches `/.session`, `/workspace/data`, and subdirectories.

```python
mlens.get_active_image() -> PIL.Image
```
Get the currently active file in the editor.

### Adding Layers

```python
mlens.add_image_layer(name: str, image: PIL.Image, **style) -> str
```
Add a raster layer (mask, heatmap) to the canvas.
- `opacity`: Layer opacity (0-1)

```python
mlens.add_annotation_layer(name: str, annotations: list, **style) -> str
```
Add vector annotations (points, polygons, lines).
- `color`: Annotation color (hex string)

Annotation format:
```python
[
    {"type": "point", "x": 100, "y": 200, "label": "A"},
    {"type": "polygon", "points": [[0,0], [100,0], [100,100]]},
    {"type": "line", "points": [[0,0], [100,100]]}
]
```

### Artifacts

```python
mlens.add_related_plot(name: str, figure: matplotlib.Figure) -> str
```
Attach a matplotlib figure as a related artifact.

```python
mlens.report_layer_data(layer_name: str, blocks: list) -> str
```
Report structured analysis data for a layer.

### Utilities

```python
await mlens.install_package(package_name: str)
```
Install a PyPI package at runtime via micropip.

```python
mlens.convert_image(virtual_path: str, max_dim: int = 4096)
```
Convert and resize an image.

---

## Creating a New Role

### Example: Geospatial Analysis Role

1. **Create folder structure**:
```
geo.role/
├── manifest.json
├── prompt.md
└── helpers/
    └── geo.py
```

2. **Define manifest.json**:
```json
{
  "id": "geospatial",
  "name": "GeoLens",
  "description": "Geospatial image analysis and land classification.",
  "version": "1.0.0",
  "packages": [
    "numpy",
    "Pillow",
    "scikit-image",
    "matplotlib"
  ],
  "helpers": ["geo.py"],
  "artifactTypes": ["image", "layer", "data"]
}
```

3. **Write prompt.md**:
```markdown
You are GeoLens, a geospatial analysis assistant.

DOMAIN API ('import geo'):
- `geo.load_image(filename)` -> PIL.Image
- `geo.classify_land_use(image)` -> classification mask
- `geo.calculate_ndvi(image)` -> NDVI layer
- `geo.add_layer(name, data)` -> add visualization layer

Help users analyze satellite imagery, classify land use, and detect changes.
```

4. **Implement geo.py**:
```python
import core
import sys
import types
import numpy as np
from PIL import Image

class GeoHelper:
    def load_image(self, filename):
        # ... implementation
        pass

    def classify_land_use(self, image):
        # K-means or other classification
        pass

    def calculate_ndvi(self, image):
        # Normalized Difference Vegetation Index
        pass

_impl = GeoHelper()
geo = types.ModuleType("geo")
for attr in dir(_impl):
    if not attr.startswith("_"):
        setattr(geo, attr, getattr(_impl, attr))
sys.modules["geo"] = geo
```

---

## Role Loading Flow

1. User selects/installs a role
2. App reads `manifest.json` for configuration
3. Required packages installed via micropip
4. Helper modules loaded into Pyodide
5. System prompt from `prompt.md` prepended to conversations
6. Gemini can now use domain-specific APIs in `python:run` blocks

---

## Existing Roles

| Role | ID | Description |
|------|-----|-------------|
| `mlens.role` | `biomedical` | Biomedical image analysis (histology, microscopy) |
| `geo-oa.role` | `geospatial` | Geospatial/satellite image analysis |
