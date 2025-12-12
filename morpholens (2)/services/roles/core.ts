
export const CORE_MODULE_SOURCE = `
# core.py - Base primitives for all roles
import js
from pyodide.ffi import to_js
import json
import os
import sys
import random
import string
import shutil

# Try to import standard data science libs if available to make them accessible via core
try:
    import numpy as np
except ImportError:
    pass

try:
    import pandas as pd
except ImportError:
    pass

_core_state = {
    "context": {},
    "artifacts": [],
}

_core_actions = []

def register_artifact(path, type="file", metadata=None):
    _core_actions.append({
        "type": "register_artifact",
        "path": path,
        "artifactType": type,
        "metadata": metadata or {}
    })

def get_artifacts():
    return _core_state["artifacts"].copy()

def get_context():
    return _core_state["context"].copy()

def get_active_file():
    return _core_state["context"].get("active_file")

def save_file(path, data, encoding=None):
    dirname = os.path.dirname(path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)

    if hasattr(data, 'tobytes'):
        with open(path, 'wb') as f:
            f.write(data.tobytes())
    elif hasattr(data, 'save'):
        data.save(path)
    elif isinstance(data, bytes):
        with open(path, 'wb') as f:
            f.write(data)
    elif isinstance(data, str):
        with open(path, 'w', encoding=encoding or 'utf-8') as f:
            f.write(data)
    else:
        raise TypeError(f"Cannot save data of type {type(data)}")

def read_file(path, binary=False):
    mode = 'rb' if binary else 'r'
    with open(path, mode) as f:
        return f.read()

def list_files(directory="/.session"):
    if not os.path.exists(directory):
        return []
    return os.listdir(directory)

async def install_package(name):
    import micropip
    await micropip.install(name)

def log(message, level="info"):
    _core_actions.append({
        "type": "log",
        "message": message,
        "level": level
    })

def set_status(message):
    _core_actions.append({
        "type": "set_status",
        "message": message
    })

# --- Workspace & Layer Utilities ---

def load_image(filename):
    from PIL import Image
    if os.path.exists(filename): return Image.open(filename)
    paths = [os.path.join('/.session', filename), os.path.join('/workspace/data', filename)]
    for p in paths:
        if os.path.exists(p): return Image.open(p)
    for root, dirs, files in os.walk('/workspace/data'):
        if filename in files: return Image.open(os.path.join(root, filename))
    raise FileNotFoundError(f"Could not find {filename}")

def get_active_image():
    active = get_active_file()
    if not active: raise Exception("No active file selected.")
    if active.get('virtualPath'): return load_image(active['virtualPath'])
    raise FileNotFoundError("Active file not found.")

def add_layer(name, layer_type, data, target_file=None, **style):
    """
    Adds a layer to a file. 
    layer_type: 'RASTER' (Image) or 'VECTOR' (List of dicts/shapes)
    data: PIL Image (for RASTER) or List (for VECTOR)
    """
    if not layer_type:
        if isinstance(data, list): layer_type = 'VECTOR'
        elif hasattr(data, 'save'): layer_type = 'RASTER'
        else: layer_type = 'VECTOR'

    action = {
        "type": "add_layer", 
        "target_file": target_file, 
        "name": name, 
        "layer_type": layer_type.upper(), 
        "style": style
    }
    
    if layer_type.upper() == 'RASTER':
        if hasattr(data, 'save'): 
            rand_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
            safe_name = "".join([c for c in name if c.isalnum() or c in (' ','-','_')]).strip().replace(' ', '_')
            fname = f"layer_{safe_name}_{rand_str}.png"
            vfs_path = f"/.session/{fname}"
            data.save(vfs_path)
            action['source'] = vfs_path
        elif isinstance(data, str): action['source'] = data
        else: return "Error: Raster data must be Image or path."
    elif layer_type.upper() == 'VECTOR':
        try:
            # Handle PyProxy conversion if applicable (from JS)
            action['source'] = data 
            if hasattr(data, 'to_py'): action['source'] = data.to_py()
        except:
            action['source'] = data
        
    _core_actions.append(action)
    return f"Queueing creation of {layer_type} layer '{name}'."

def add_plot(name, data, target_file=None):
    rand_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    safe_name = "".join([c for c in name if c.isalnum() or c in (' ','-','_')]).strip().replace(' ', '_')
    fname = f"artifact_{safe_name}_{rand_str}.png"
    vfs_path = f"/.session/{fname}"
    try:
        if hasattr(data, 'savefig'): data.savefig(vfs_path)
        elif hasattr(data, 'save'): data.save(vfs_path)
        else: return "Error: Data must be Figure or Image."
    except Exception as e: return f"Error saving: {str(e)}"

    _core_actions.append({
        "type": "attach_artifact", 
        "target_file": target_file, 
        "name": name, 
        "artifact_type": "PLOT", 
        "source": vfs_path
    })
    return f"Attached plot '{name}'."

def update_layer_data(layer_name, blocks, target_file=None):
    _core_actions.append({
        "type": "update_layer_data", 
        "target_file": target_file, 
        "layer_name": layer_name, 
        "blocks": blocks
    })
    return f"Updated data blocks for layer '{layer_name}'."

def save_to_project(filename, folder=None):
    src = os.path.join('/.session', filename)
    dest_dir = '/workspace/data'
    if folder:
        dest_dir = os.path.join(dest_dir, folder)
        if not os.path.exists(dest_dir): os.makedirs(dest_dir)
    dst = os.path.join(dest_dir, filename)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        return f"Saved {filename} to {dst}."
    raise FileNotFoundError(f"File {filename} not found.")

# --- Media Utilities ---

def convert_image(virtual_path, max_dim=4096):
    from PIL import Image
    import io
    if not os.path.exists(virtual_path): raise FileNotFoundError(f"File not found: {virtual_path}")
    img = Image.open(virtual_path)
    if img.mode not in ('RGB', 'RGBA'): img = img.convert('RGB')
    width, height = img.size
    if width > max_dim or height > max_dim: img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf.read()

def convert_video_to_gif(virtual_path, max_frames=30, max_dim=320):
    import cv2
    import numpy as np
    from PIL import Image
    import io
    
    if not os.path.exists(virtual_path): raise FileNotFoundError(f"File not found: {virtual_path}")
    
    cap = cv2.VideoCapture(virtual_path)
    if not cap.isOpened():
            raise Exception("Could not open video file.")

    frames = []
    frame_count = 0
    
    while frame_count < max_frames:
        ret, frame = cap.read()
        if not ret: break
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_frame)
        width, height = pil_img.size
        if width > max_dim or height > max_dim:
            pil_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        frames.append(pil_img)
        frame_count += 1
        
    cap.release()
    
    if not frames: raise Exception("No frames extracted.")
        
    buf = io.BytesIO()
    frames[0].save(buf, format='GIF', save_all=True, append_images=frames[1:], duration=200, loop=0, optimize=True)
    buf.seek(0)
    return buf.read()

# Internal
def _set_context(context):
    _core_state["context"] = context

def _get_actions():
    actions = _core_actions.copy()
    _core_actions.clear()
    return actions

def _clear_session():
    _core_state["artifacts"] = []
    _core_actions.clear()
`;

export function getCoreModuleSource(): string {
  return CORE_MODULE_SOURCE;
}
