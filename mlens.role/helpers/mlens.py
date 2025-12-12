
import core
import os
import shutil
import sys
import types
import json
import random
import string
from PIL import Image

class MorphoLens:
    def list_files(self):
        return core.list_files()

    def load_image(self, filename):
        if os.path.exists(filename): return Image.open(filename)
        paths = [os.path.join('/.session', filename), os.path.join('/workspace/data', filename)]
        for p in paths:
            if os.path.exists(p): return Image.open(p)
        for root, dirs, files in os.walk('/workspace/data'):
            if filename in files: return Image.open(os.path.join(root, filename))
        raise FileNotFoundError(f"Could not find {filename}")

    def get_active_image(self):
        active = core.get_active_file()
        if not active: raise Exception("No active file selected.")
        if active.get('virtualPath'): return self.load_image(active['virtualPath'])
        raise FileNotFoundError("Active file not found.")

    def add_layer(self, name, layer_type, data, target_file=None, **style):
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
                action['source'] = data
                if hasattr(data, 'to_py'): action['source'] = data.to_py()
            except:
                action['source'] = data

        core._core_actions.append(action)
        return f"Queueing creation of {layer_type} layer '{name}'."

    def add_image_layer(self, name, data, **style):
        return self.add_layer(name, 'RASTER', data, **style)

    def add_annotation_layer(self, name, data, **style):
        return self.add_layer(name, 'VECTOR', data, **style)

    def add_related_plot(self, name, data, target_file=None):
        rand_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        safe_name = "".join([c for c in name if c.isalnum() or c in (' ','-','_')]).strip().replace(' ', '_')
        fname = f"artifact_{safe_name}_{rand_str}.png"
        vfs_path = f"/.session/{fname}"
        try:
            if hasattr(data, 'savefig'): data.savefig(vfs_path)
            elif hasattr(data, 'save'): data.save(vfs_path)
            else: return "Error: Data must be Figure or Image."
        except Exception as e: return f"Error saving: {str(e)}"

        core._core_actions.append({
            "type": "attach_artifact",
            "target_file": target_file,
            "name": name,
            "artifact_type": "PLOT",
            "source": vfs_path
        })
        return f"Attached plot '{name}'."

    def save_to_project(self, filename, folder=None):
        return core.save_file(filename) # Simplified delegation

    async def install_package(self, package_name):
        return await core.install_package(package_name)

    def update_metrics(self, target_file, metrics):
        # Just return the dict, tool wrapper handles it
        return {"type": "analysis_result", "target_file": target_file, "metrics": metrics}

    def report_layer_data(self, layer_name, blocks, target_file=None):
        core._core_actions.append({
            "type": "update_layer_data",
            "target_file": target_file,
            "layer_name": layer_name,
            "blocks": blocks
        })
        return f"Updated data blocks for layer '{layer_name}'."

    def convert_image(self, virtual_path, max_dim=4096):
        return core.convert_image(virtual_path, max_dim)

    def convert_video_to_gif(self, virtual_path, max_frames=30, max_dim=320):
        return core.convert_video_to_gif(virtual_path, max_frames, max_dim)

_mlens_impl = MorphoLens()
mlens = types.ModuleType("mlens")
for attr in dir(_mlens_impl):
    if not attr.startswith("_"): setattr(mlens, attr, getattr(_mlens_impl, attr))
sys.modules["mlens"] = mlens
