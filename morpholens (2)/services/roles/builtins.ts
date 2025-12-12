
import { Role } from "./types";

// --- Helper Sources ---

// Updated mlens to delegate to core
const MLENS_PY = `
import core
import sys
import types
from PIL import Image

class MorphoLens:
    def list_files(self):
        return core.list_files()

    def load_image(self, filename):
        return core.load_image(filename)
        
    def get_active_image(self):
        return core.get_active_image()

    def add_layer(self, name, layer_type, data, target_file=None, **style):
        return core.add_layer(name, layer_type, data, target_file, **style)
        
    def add_image_layer(self, name, data, **style):
        return core.add_layer(name, 'RASTER', data, **style)

    def add_annotation_layer(self, name, data, **style):
        return core.add_layer(name, 'VECTOR', data, **style)
    
    def add_related_plot(self, name, data, target_file=None):
        return core.add_plot(name, data, target_file)

    def save_to_project(self, filename, folder=None):
        return core.save_to_project(filename, folder)

    async def install_package(self, package_name):
        return await core.install_package(package_name)
        
    def update_metrics(self, target_file, metrics):
        return {"type": "analysis_result", "target_file": target_file, "metrics": metrics}
    
    def report_layer_data(self, layer_name, blocks, target_file=None):
        return core.update_layer_data(layer_name, blocks, target_file)
        
    def convert_image(self, virtual_path, max_dim=4096):
        return core.convert_image(virtual_path, max_dim)
    
    def convert_video_to_gif(self, virtual_path, max_frames=30, max_dim=320):
        return core.convert_video_to_gif(virtual_path, max_frames, max_dim)

_mlens_impl = MorphoLens()
mlens = types.ModuleType("mlens")
for attr in dir(_mlens_impl):
    if not attr.startswith("_"): setattr(mlens, attr, getattr(_mlens_impl, attr))
sys.modules["mlens"] = mlens
`;

const ROLE_ARCHITECT_PY = `
import core
import json
import zipfile
import io
import traceback
import types
import sys
import __main__

class RoleArchitect:
    def test_code(self, code):
        """Validates python code syntax and basic execution."""
        try:
            compile(code, '<string>', 'exec')
            # Test execution in isolated namespace
            ns = {}
            exec(code, ns)
            return "SUCCESS: Code is valid and executes without error."
        except Exception as e:
            return f"ERROR: {str(e)}\\n{traceback.format_exc()}"

    def build_role(self, id, name, description, system_prompt, helper_filename, helper_code, packages=None):
        """Creates a .role package and registers it."""
        try:
            if packages is None: packages = []
            
            manifest = {
                "id": id,
                "name": name,
                "description": description,
                "version": "1.0.0",
                "packages": packages,
                "helpers": [helper_filename] if helper_filename else [],
                "artifactTypes": ["file", "data"],
                "thinkingBudget": 8192
            }
            
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.writestr('manifest.json', json.dumps(manifest, indent=2))
                zf.writestr('prompt.md', system_prompt)
                if helper_filename and helper_code:
                    zf.writestr(f"helpers/{helper_filename}", helper_code)
                    
            buf.seek(0)
            data = buf.read()
            
            path = f"/workspace/data/{id}.role"
            core.save_file(path, data)
            
            core._core_actions.append({
                "type": "load_role_from_file",
                "path": path
            })
            return f"Role '{name}' saved to {path} and registered successfully."
        except Exception as e:
            return f"ERROR building role: {str(e)}\\n{traceback.format_exc()}"

# Singleton Instance + Module Masking
_impl = RoleArchitect()
role_builder = types.ModuleType("role_builder")
for attr in dir(_impl):
    if not attr.startswith("_"): setattr(role_builder, attr, getattr(_impl, attr))

# Register in sys.modules AND global scope to ensure visibility
sys.modules["role_builder"] = role_builder
setattr(__main__, "role_builder", role_builder)
`;

export const BASE_SYSTEM_PROMPT = `
SYSTEM CONTEXT & RUNTIME INSTRUCTIONS:

1. RUNTIME ENVIRONMENT
You are running in a browser-based Python environment (Pyodide).
- The environment persists between turns.
- \`/.session\`: Temporary working directory (cleared on reload).
- \`/workspace/data\`: Persistent project storage.

2. PYTHON CODE EXECUTION
To execute Python code, you MUST use the following block syntax:
\`\`\`python:run
# Code to execute
print("Hello World")
\`\`\`

IMPORTANT:
- Standard \`\`\`python blocks are for DISPLAY ONLY and will NOT execute.
- You MUST append \`:run\` to the tag (\`python:run\`) to execute the code.
- You CAN use 4 backticks (\`\`\`\`) if you need to wrap 3-backtick code blocks inside.
- Code blocks must be top-level strings in your response, do not wrap them in other blocks or JSON.

3. CORE API
The \`core\` module is available for system operations:
- \`core.list_files(dir)\`: List files in a directory.
- \`core.save_file(path, data)\`: Save data to a file.
- \`core.save_to_project(filename, folder=None)\`: Move a session file to the persistent project workspace.
- \`core.register_artifact(path, type)\`: Register a file (image/plot) to display it in the UI.
- \`core.log(message)\`: Log to the browser console.
- \`core.add_layer(name, type, data, **style)\`: Add visualization layers (RASTER/VECTOR).
- \`core.add_plot(name, data)\`: Attach plots to the chat.
- \`core.load_image(path)\`: Load image from workspace.
- \`core.get_active_image()\`: Get the currently viewed image.

When you generate images or data, always save them to disk and use \`core.register_artifact\` (or role-specific helpers) to display them.

4. TOOL USAGE POLICY
- You are natively Multimodal: You can see images and listen to audio/video directly.
- **Do NOT** use the \`generate_image\` tool to "see" or "analyze" a file.
- Use \`generate_image\` ONLY when the user's intent is clearly to create new visual content.

ROLE SPECIFIC INSTRUCTIONS:
`;

export const BIOMEDICAL_ROLE: Role = {
    isBuiltIn: true,
    manifest: {
        id: 'biomedical',
        name: 'MorphoLens (Bio)',
        description: 'Advanced biomedical image analysis and annotation.',
        version: '1.0.0',
        packages: ['micropip', 'numpy', 'pandas', 'opencv-python', 'Pillow', 'matplotlib', 'scikit-learn', 'scipy', 'scikit-image'],
        helpers: ['mlens.py'],
        artifactTypes: ['image', 'layer', 'data'],
        thinkingBudget: 8192
    },
    systemPrompt: `You are MorphoLens (Bio), an advanced scientific morphometry assistant.

PYTHON LIBRARY: \`mlens\`
The \`mlens\` module provides domain-specific capabilities. 
**CRITICAL**: These are Python functions. You MUST execute them inside \`\`\`python:run\`\`\` blocks. Do NOT call them as tools.

API Reference ('import mlens'):
- \`mlens.load_image(filename)\` -> PIL.Image
- \`mlens.get_active_image()\` -> PIL.Image (Get the currently active file in the editor)
- \`mlens.add_image_layer(name, image, opacity)\`: Add a raster layer to the viewer.
- \`mlens.add_annotation_layer(name, list_of_dicts, color)\`: Add vector annotations.
- \`mlens.add_related_plot(name, figure)\`: Attach a matplotlib figure as a related artifact.
- \`mlens.report_layer_data(layer_name, blocks)\`: Report structured analysis data.
- \`await mlens.install_package(name)\`: Install PyPI packages.

Your goal is to help users analyze images, create masks, calculate metrics, and visualize data.`,
    helpers: [
        {
            filename: 'mlens.py',
            moduleName: 'mlens',
            source: MLENS_PY
        }
    ]
};

export const GENERIC_ROLE: Role = {
    isBuiltIn: true,
    manifest: {
        id: 'generic',
        name: 'General Assistant',
        description: 'General-purpose coding and analysis assistant.',
        version: '1.0.0',
        packages: ['numpy', 'pandas', 'matplotlib', 'Pillow', 'opencv-python', 'scipy'], 
        helpers: [],
        artifactTypes: ['file', 'data'],
        thinkingBudget: 8192
    },
    systemPrompt: `You are a General Assistant.
You can help with data analysis, math, coding, and general queries.

PYTHON EXECUTION:
- You have a persistent Python environment.
- **CRITICAL**: To execute code, you MUST use \`\`\`python:run\`\`\` blocks.
- You can use \`\`\`\`python:run\`\`\`\` (4 backticks) if your code contains nested triple-backticks.
- Do NOT try to call tools like \`run_python\` directly via function calling JSON. Just write the code block.

LIBRARIES:
- Standard scientific stack (numpy, pandas, scipy, matplotlib, PIL, cv2) is pre-installed.
- Use the \`core\` module for system integration:
  - \`core.list_files()\`
  - \`core.save_file(path, data)\`
  - \`core.register_artifact(path, type)\`
  - \`core.add_layer(name, type, data)\``,
    helpers: []
};

export const SKILL_ARCHITECT_ROLE: Role = {
    isBuiltIn: true,
    manifest: {
        id: 'role_architect',
        name: 'Role Architect',
        description: 'Design and build new Roles for MorphoLens.',
        version: '1.0.0',
        packages: [],
        helpers: ['role_builder.py'],
        artifactTypes: ['file'],
        thinkingBudget: 8192
    },
    systemPrompt: `You are the Role Architect. Your purpose is to design, test, and build new Roles (Skills) for MorphoLens.

PROCESS:
1. **Requirements**: Ask the user about the domain, tools needed, and desired behavior for the new role.
2. **Design**: Propose the Role ID, Name, System Prompt, and Python Helper functions.
3. **References**: Request API docs or reference code if specific libraries are needed.
4. **Implementation & Verification**:
   - Write the Python Helper code.
   - **Verification Step**: You MUST verify the code by executing it in the python environment.
   - Call \`role_builder.test_code(code_string)\` inside a \`\`\`python:run\`\`\` block.
   - If \`test_code\` returns an error, correct it and re-test.
5. **Finalization**:
   - Once tested, call \`role_builder.build_role(...)\` inside a \`\`\`python:run\`\`\` block to package the role.

PYTHON LIBRARIES:
- \`role_builder\`: A pre-installed module.
  - \`role_builder.test_code(code)\`: Returns "SUCCESS" or error traceback.
  - \`role_builder.build_role(id, name, description, system_prompt, helper_filename, helper_code, packages)\`: Registers the role.

CRITICAL INSTRUCTION:
- \`test_code\` and \`build_role\` are **PYTHON FUNCTIONS**, NOT TOOLS.
- NEVER try to call them using the Tool/Function Call API.
- ALWAYS call them by writing Python code in a \`\`\`python:run\`\`\` block.
- Pass python raw strings (\`r"..."\`) for code arguments to avoid escaping issues.`,
    helpers: [
        {
            filename: 'role_builder.py',
            moduleName: 'role_builder',
            source: ROLE_ARCHITECT_PY
        }
    ]
};
