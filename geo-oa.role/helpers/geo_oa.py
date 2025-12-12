# geo_oa.py - Tang/Yao uCT OA Geometric Indices Protocol Helper
# Provides functions for measuring and interpreting osteoarthritis severity in murine knee joints

import core
import os
import sys
import types
import json
import random
import string
import math
from PIL import Image, ImageDraw, ImageFont

# ============================================================================
# PROTOCOL CONSTANTS - Tang/Yao Geometric Indices
# ============================================================================

# Distal Femur Width/Length Ratio Thresholds
FEMORAL_WL_NORMAL_MAX = 1.28      # Below this = definitively normal
FEMORAL_WL_OA_MIN = 1.30          # Above this = definitively OA
FEMORAL_WL_BORDERLINE = (1.28, 1.30)  # Borderline range

# Proximal Tibia Height/Width Ratio Thresholds
TIBIAL_HW_NORMAL_MIN = 0.28       # Above this = definitively normal
TIBIAL_HW_OA_MAX = 0.27           # Below this = definitively OA
TIBIAL_HW_BORDERLINE = (0.27, 0.28)  # Borderline range

# Default uCT voxel size (Scanco VivaCT 40)
DEFAULT_VOXEL_SIZE_UM = 10.5
DEFAULT_VOXEL_SIZE_MM = 0.0105

# Reference ranges for comparison
REFERENCE_RANGES = {
    'normal_adult': {
        'description': 'Normal adult mouse (5 months, C57BL/6)',
        'femoral_wl_ratio': (1.20, 1.25),
        'tibial_hw_ratio': (0.30, 0.35)
    },
    'ptoa_8wk': {
        'description': 'Post-traumatic OA (MMS, 8 weeks)',
        'femoral_wl_ratio': (1.35, 1.50),
        'tibial_hw_ratio': (0.20, 0.26)
    },
    'aroa_28mo': {
        'description': 'Age-related OA (28 months)',
        'femoral_wl_ratio': (1.33, 1.60),
        'tibial_hw_ratio': (0.22, 0.28)
    }
}

# Visualization colors (RGB)
COLORS = {
    'femoral_width': (255, 255, 0),     # Yellow
    'femoral_length': (0, 255, 255),    # Cyan
    'tibial_width': (0, 255, 0),        # Green
    'iioc_height': (255, 0, 255),       # Magenta
    'normal': (0, 200, 0),              # Green
    'borderline': (255, 165, 0),        # Orange
    'oa': (255, 0, 0),                  # Red
    'landmark': (255, 255, 255)         # White
}


# ============================================================================
# MEASUREMENT CALCULATIONS
# ============================================================================

def distance(point1, point2):
    """Calculate Euclidean distance between two points (in pixels)."""
    x1, y1 = point1
    x2, y2 = point2
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)


def pixels_to_mm(pixels, voxel_size_mm=DEFAULT_VOXEL_SIZE_MM):
    """Convert pixel distance to millimeters."""
    return pixels * voxel_size_mm


def mm_to_pixels(mm, voxel_size_mm=DEFAULT_VOXEL_SIZE_MM):
    """Convert millimeters to pixels."""
    return mm / voxel_size_mm


def calculate_femoral_ratio(width_mm, length_mm):
    """
    Calculate distal femoral width/length ratio and interpret OA status.

    Args:
        width_mm: Distal femoral width in mm (lateral to medial condyle edges)
        length_mm: Distal femoral length in mm (groove midpoint to intercondylar notch)

    Returns:
        dict with ratio, status, interpretation, and color code
    """
    if length_mm <= 0:
        return {'error': 'Invalid length (must be > 0)'}

    ratio = width_mm / length_mm

    if ratio < FEMORAL_WL_NORMAL_MAX:
        status = 'NORMAL'
        interpretation = 'No significant osteophyte formation detected'
        color = COLORS['normal']
    elif ratio > FEMORAL_WL_OA_MIN:
        status = 'OA'
        interpretation = 'Elevated ratio indicates osteophyte formation consistent with osteoarthritis'
        color = COLORS['oa']
    else:
        status = 'BORDERLINE'
        interpretation = 'Ratio in borderline range; may indicate early OA changes'
        color = COLORS['borderline']

    return {
        'ratio': round(ratio, 3),
        'status': status,
        'interpretation': interpretation,
        'color': color,
        'width_mm': round(width_mm, 3),
        'length_mm': round(length_mm, 3),
        'threshold_normal': FEMORAL_WL_NORMAL_MAX,
        'threshold_oa': FEMORAL_WL_OA_MIN
    }


def calculate_tibial_ratio(height_mm, width_mm):
    """
    Calculate tibial IIOC height/width ratio and interpret OA status.

    Args:
        height_mm: Maximum IIOC height in mm (articular surface to growth plate)
        width_mm: Tibial width in mm (at growth plate level)

    Returns:
        dict with ratio, status, interpretation, and color code
    """
    if width_mm <= 0:
        return {'error': 'Invalid width (must be > 0)'}

    ratio = height_mm / width_mm

    if ratio > TIBIAL_HW_NORMAL_MIN:
        status = 'NORMAL'
        interpretation = 'No significant subchondral collapse or osteophyte formation'
        color = COLORS['normal']
    elif ratio < TIBIAL_HW_OA_MAX:
        status = 'OA'
        interpretation = 'Reduced ratio indicates subchondral bone collapse and/or osteophyte formation'
        color = COLORS['oa']
    else:
        status = 'BORDERLINE'
        interpretation = 'Ratio in borderline range; may indicate early OA changes'
        color = COLORS['borderline']

    return {
        'ratio': round(ratio, 3),
        'status': status,
        'interpretation': interpretation,
        'color': color,
        'height_mm': round(height_mm, 3),
        'width_mm': round(width_mm, 3),
        'threshold_normal': TIBIAL_HW_NORMAL_MIN,
        'threshold_oa': TIBIAL_HW_OA_MAX
    }


def interpret_oa_status(femoral_ratio, tibial_ratio):
    """
    Provide overall OA assessment based on both femoral and tibial ratios.

    Args:
        femoral_ratio: Femoral W/L ratio (float)
        tibial_ratio: Tibial H/W ratio (float)

    Returns:
        dict with overall assessment
    """
    femoral_status = 'NORMAL' if femoral_ratio < FEMORAL_WL_NORMAL_MAX else (
        'OA' if femoral_ratio > FEMORAL_WL_OA_MIN else 'BORDERLINE')

    tibial_status = 'NORMAL' if tibial_ratio > TIBIAL_HW_NORMAL_MIN else (
        'OA' if tibial_ratio < TIBIAL_HW_OA_MAX else 'BORDERLINE')

    # Overall assessment logic
    if femoral_status == 'OA' or tibial_status == 'OA':
        overall = 'OA'
        severity = 'Osteoarthritic changes detected'
        if femoral_status == 'OA' and tibial_status == 'OA':
            severity = 'Significant OA: Both femoral and tibial indices abnormal'
        elif femoral_status == 'OA':
            severity = 'OA indicated by femoral ratio (osteophyte formation)'
        else:
            severity = 'OA indicated by tibial ratio (subchondral collapse/osteophytes)'
    elif femoral_status == 'BORDERLINE' or tibial_status == 'BORDERLINE':
        overall = 'BORDERLINE'
        severity = 'Early or mild changes possible; continued monitoring recommended'
    else:
        overall = 'NORMAL'
        severity = 'No significant osteoarthritic changes detected'

    return {
        'overall_status': overall,
        'severity_description': severity,
        'femoral_status': femoral_status,
        'tibial_status': tibial_status,
        'femoral_ratio': round(femoral_ratio, 3),
        'tibial_ratio': round(tibial_ratio, 3)
    }


# ============================================================================
# VISUALIZATION FUNCTIONS
# ============================================================================

def draw_measurement_line(image, point1, point2, label=None, color=(255, 255, 0), line_width=2):
    """
    Draw a measurement line on an image with optional label.

    Args:
        image: PIL Image object
        point1: (x, y) tuple for start point
        point2: (x, y) tuple for end point
        label: Text label to display (e.g., "2.35 mm")
        color: RGB tuple for line color
        line_width: Width of the line

    Returns:
        Modified PIL Image
    """
    img = image.copy()
    draw = ImageDraw.Draw(img)

    # Draw the line
    draw.line([point1, point2], fill=color, width=line_width)

    # Draw endpoint markers
    marker_size = 4
    for pt in [point1, point2]:
        x, y = pt
        draw.ellipse([x-marker_size, y-marker_size, x+marker_size, y+marker_size],
                     fill=color, outline=color)

    # Add label if provided
    if label:
        mid_x = (point1[0] + point2[0]) / 2
        mid_y = (point1[1] + point2[1]) / 2
        # Offset label slightly
        draw.text((mid_x + 5, mid_y - 10), label, fill=color)

    return img


def draw_landmark(image, point, label=None, color=(255, 255, 255), size=6):
    """
    Draw a landmark point on an image.

    Args:
        image: PIL Image object
        point: (x, y) tuple
        label: Optional text label
        color: RGB tuple
        size: Marker size

    Returns:
        Modified PIL Image
    """
    img = image.copy()
    draw = ImageDraw.Draw(img)

    x, y = point
    # Draw crosshair
    draw.line([(x-size, y), (x+size, y)], fill=color, width=1)
    draw.line([(x, y-size), (x, y+size)], fill=color, width=1)
    # Draw circle
    draw.ellipse([x-size//2, y-size//2, x+size//2, y+size//2], outline=color, width=1)

    if label:
        draw.text((x + size + 2, y - 5), label, fill=color)

    return img


def create_measurement_overlay(image, landmarks, voxel_size_mm=DEFAULT_VOXEL_SIZE_MM):
    """
    Create a complete measurement overlay on a uCT image.

    Args:
        image: PIL Image object
        landmarks: dict with 'femoral' and 'tibial' landmark dicts
        voxel_size_mm: Voxel size for mm conversion

    Returns:
        PIL Image with measurement overlay
    """
    img = image.copy()
    if img.mode != 'RGB':
        img = img.convert('RGB')

    femoral = landmarks.get('femoral', {})
    tibial = landmarks.get('tibial', {})

    # Draw femoral measurements
    if 'lateral_condyle' in femoral and 'medial_condyle' in femoral:
        width_px = distance(femoral['lateral_condyle'], femoral['medial_condyle'])
        width_mm = pixels_to_mm(width_px, voxel_size_mm)
        img = draw_measurement_line(
            img,
            femoral['lateral_condyle'],
            femoral['medial_condyle'],
            f"W: {width_mm:.2f} mm",
            COLORS['femoral_width']
        )

    if 'groove_midpoint' in femoral and 'intercondylar_notch' in femoral:
        length_px = distance(femoral['groove_midpoint'], femoral['intercondylar_notch'])
        length_mm = pixels_to_mm(length_px, voxel_size_mm)
        img = draw_measurement_line(
            img,
            femoral['groove_midpoint'],
            femoral['intercondylar_notch'],
            f"L: {length_mm:.2f} mm",
            COLORS['femoral_length']
        )

    # Draw tibial measurements
    if 'lateral_border' in tibial and 'medial_border' in tibial:
        width_px = distance(tibial['lateral_border'], tibial['medial_border'])
        width_mm = pixels_to_mm(width_px, voxel_size_mm)
        img = draw_measurement_line(
            img,
            tibial['lateral_border'],
            tibial['medial_border'],
            f"W: {width_mm:.2f} mm",
            COLORS['tibial_width']
        )

    if 'articular_surface' in tibial and 'growth_plate' in tibial:
        height_px = distance(tibial['articular_surface'], tibial['growth_plate'])
        height_mm = pixels_to_mm(height_px, voxel_size_mm)
        img = draw_measurement_line(
            img,
            tibial['articular_surface'],
            tibial['growth_plate'],
            f"H: {height_mm:.2f} mm",
            COLORS['iioc_height']
        )

    return img


# ============================================================================
# REPORTING FUNCTIONS
# ============================================================================

def generate_report(measurements):
    """
    Generate a structured report from OA measurements.

    Args:
        measurements: dict containing all measurements and results

    Returns:
        List of report blocks suitable for report_layer_data()
    """
    blocks = []

    # Header block
    blocks.append({
        'type': 'text',
        'content': '## uCT OA Analysis Report\n### Tang/Yao Geometric Indices Protocol'
    })

    # Femoral measurements
    if 'femoral_width_mm' in measurements:
        femoral_data = {
            'Width (mm)': measurements.get('femoral_width_mm', 'N/A'),
            'Length (mm)': measurements.get('femoral_length_mm', 'N/A'),
            'W/L Ratio': measurements.get('femoral_wl_ratio', 'N/A'),
            'Status': measurements.get('femoral_status', 'N/A')
        }
        blocks.append({
            'type': 'key_value',
            'title': 'Distal Femur',
            'data': femoral_data
        })

    # Tibial measurements
    if 'tibial_width_mm' in measurements:
        tibial_data = {
            'Width (mm)': measurements.get('tibial_width_mm', 'N/A'),
            'IIOC Height (mm)': measurements.get('iioc_height_mm', 'N/A'),
            'H/W Ratio': measurements.get('tibial_hw_ratio', 'N/A'),
            'Status': measurements.get('tibial_status', 'N/A')
        }
        blocks.append({
            'type': 'key_value',
            'title': 'Proximal Tibia',
            'data': tibial_data
        })

    # Overall assessment
    if 'overall_assessment' in measurements:
        assessment = measurements['overall_assessment']
        blocks.append({
            'type': 'key_value',
            'title': 'Overall Assessment',
            'data': {
                'Status': assessment.get('overall_status', 'N/A'),
                'Description': assessment.get('severity_description', 'N/A')
            }
        })

    # Reference thresholds
    blocks.append({
        'type': 'text',
        'content': f'''
### Reference Thresholds
- **Femoral W/L**: <{FEMORAL_WL_NORMAL_MAX} normal, >{FEMORAL_WL_OA_MIN} OA
- **Tibial H/W**: >{TIBIAL_HW_NORMAL_MIN} normal, <{TIBIAL_HW_OA_MAX} OA
'''
    })

    return blocks


def export_csv(measurements, filename):
    """
    Export measurements to CSV format.

    Args:
        measurements: dict or list of measurement dicts
        filename: Output filename

    Returns:
        Path to saved CSV file
    """
    import csv

    if not filename.endswith('.csv'):
        filename += '.csv'

    path = f"/.session/{filename}"

    # Handle single measurement or list
    if isinstance(measurements, dict):
        measurements = [measurements]

    if not measurements:
        return None

    # Get all keys from all measurements
    all_keys = set()
    for m in measurements:
        all_keys.update(m.keys())
    fieldnames = sorted(list(all_keys))

    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for m in measurements:
            writer.writerow(m)

    core.register_artifact(path, type="file", metadata={
        "format": "csv",
        "filename": filename,
        "description": "OA Measurements Export"
    })

    return path


def create_ratio_chart(measurements, reference_data=None):
    """
    Create a matplotlib chart comparing measurements to reference ranges.

    Args:
        measurements: dict with femoral_wl_ratio and tibial_hw_ratio
        reference_data: Optional reference range key from REFERENCE_RANGES

    Returns:
        matplotlib Figure object
    """
    import matplotlib.pyplot as plt
    import numpy as np

    fig, axes = plt.subplots(1, 2, figsize=(10, 4))

    # Femoral ratio chart
    ax1 = axes[0]
    femoral_ratio = measurements.get('femoral_wl_ratio', 0)

    # Draw threshold zones
    ax1.axhspan(0, FEMORAL_WL_NORMAL_MAX, alpha=0.3, color='green', label='Normal')
    ax1.axhspan(FEMORAL_WL_NORMAL_MAX, FEMORAL_WL_OA_MIN, alpha=0.3, color='orange', label='Borderline')
    ax1.axhspan(FEMORAL_WL_OA_MIN, 2.0, alpha=0.3, color='red', label='OA')

    # Plot measured value
    ax1.barh(['Measured'], [femoral_ratio], color='blue', height=0.5)
    ax1.axvline(x=FEMORAL_WL_NORMAL_MAX, color='green', linestyle='--', linewidth=2)
    ax1.axvline(x=FEMORAL_WL_OA_MIN, color='red', linestyle='--', linewidth=2)

    ax1.set_xlim(1.0, 1.8)
    ax1.set_xlabel('Ratio')
    ax1.set_title(f'Femoral W/L Ratio: {femoral_ratio:.3f}')
    ax1.legend(loc='upper right')

    # Tibial ratio chart
    ax2 = axes[1]
    tibial_ratio = measurements.get('tibial_hw_ratio', 0)

    # Draw threshold zones (note: reversed for tibial)
    ax2.axhspan(TIBIAL_HW_NORMAL_MIN, 0.5, alpha=0.3, color='green', label='Normal')
    ax2.axhspan(TIBIAL_HW_OA_MAX, TIBIAL_HW_NORMAL_MIN, alpha=0.3, color='orange', label='Borderline')
    ax2.axhspan(0, TIBIAL_HW_OA_MAX, alpha=0.3, color='red', label='OA')

    # Plot measured value
    ax2.barh(['Measured'], [tibial_ratio], color='blue', height=0.5)
    ax2.axvline(x=TIBIAL_HW_NORMAL_MIN, color='green', linestyle='--', linewidth=2)
    ax2.axvline(x=TIBIAL_HW_OA_MAX, color='red', linestyle='--', linewidth=2)

    ax2.set_xlim(0.1, 0.45)
    ax2.set_xlabel('Ratio')
    ax2.set_title(f'Tibial H/W Ratio: {tibial_ratio:.3f}')
    ax2.legend(loc='upper right')

    plt.tight_layout()
    return fig


# ============================================================================
# BASE MLENS FUNCTIONALITY (inherited)
# ============================================================================

class GeoOA:
    """Main class providing both OA-specific and base mlens functionality."""

    def list_files(self):
        return core.list_files()

    def load_image(self, filename):
        if os.path.exists(filename):
            return Image.open(filename)
        paths = [os.path.join('/.session', filename), os.path.join('/workspace/data', filename)]
        for p in paths:
            if os.path.exists(p):
                return Image.open(p)
        for root, dirs, files in os.walk('/workspace/data'):
            if filename in files:
                return Image.open(os.path.join(root, filename))
        raise FileNotFoundError(f"Could not find {filename}")

    def get_active_image(self):
        active = core.get_active_file()
        if not active:
            raise Exception("No active file selected.")
        if active.get('virtualPath'):
            return self.load_image(active['virtualPath'])
        raise FileNotFoundError("Active file not found.")

    def add_layer(self, name, layer_type, data, target_file=None, **style):
        if not layer_type:
            if isinstance(data, list):
                layer_type = 'VECTOR'
            elif hasattr(data, 'save'):
                layer_type = 'RASTER'
            else:
                layer_type = 'VECTOR'

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
                safe_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
                fname = f"layer_{safe_name}_{rand_str}.png"
                vfs_path = f"/.session/{fname}"
                data.save(vfs_path)
                action['source'] = vfs_path
            elif isinstance(data, str):
                action['source'] = data
            else:
                return "Error: Raster data must be Image or path."
        elif layer_type.upper() == 'VECTOR':
            try:
                action['source'] = data
                if hasattr(data, 'to_py'):
                    action['source'] = data.to_py()
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
        safe_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
        fname = f"artifact_{safe_name}_{rand_str}.png"
        vfs_path = f"/.session/{fname}"
        try:
            if hasattr(data, 'savefig'):
                data.savefig(vfs_path)
            elif hasattr(data, 'save'):
                data.save(vfs_path)
            else:
                return "Error: Data must be Figure or Image."
        except Exception as e:
            return f"Error saving: {str(e)}"

        core._core_actions.append({
            "type": "attach_artifact",
            "target_file": target_file,
            "name": name,
            "artifact_type": "PLOT",
            "source": vfs_path
        })
        return f"Attached plot '{name}'."

    def report_layer_data(self, layer_name, blocks, target_file=None):
        core._core_actions.append({
            "type": "update_layer_data",
            "target_file": target_file,
            "layer_name": layer_name,
            "blocks": blocks
        })
        return f"Updated data blocks for layer '{layer_name}'."

    async def install_package(self, package_name):
        return await core.install_package(package_name)

    # OA-specific methods exposed at module level
    def calculate_femoral_ratio(self, width_mm, length_mm):
        return calculate_femoral_ratio(width_mm, length_mm)

    def calculate_tibial_ratio(self, height_mm, width_mm):
        return calculate_tibial_ratio(height_mm, width_mm)

    def interpret_oa_status(self, femoral_ratio, tibial_ratio):
        return interpret_oa_status(femoral_ratio, tibial_ratio)

    def draw_measurement_line(self, image, point1, point2, label=None, color=(255, 255, 0), line_width=2):
        return draw_measurement_line(image, point1, point2, label, color, line_width)

    def create_measurement_overlay(self, image, landmarks, voxel_size_mm=DEFAULT_VOXEL_SIZE_MM):
        return create_measurement_overlay(image, landmarks, voxel_size_mm)

    def generate_report(self, measurements):
        return generate_report(measurements)

    def export_csv(self, measurements, filename):
        return export_csv(measurements, filename)

    def create_ratio_chart(self, measurements, reference_data=None):
        return create_ratio_chart(measurements, reference_data)

    def distance(self, point1, point2):
        return distance(point1, point2)

    def pixels_to_mm(self, pixels, voxel_size_mm=DEFAULT_VOXEL_SIZE_MM):
        return pixels_to_mm(pixels, voxel_size_mm)

    def mm_to_pixels(self, mm, voxel_size_mm=DEFAULT_VOXEL_SIZE_MM):
        return mm_to_pixels(mm, voxel_size_mm)


# ============================================================================
# MODULE INITIALIZATION
# ============================================================================

_geo_oa_impl = GeoOA()
geo_oa = types.ModuleType("geo_oa")

# Copy all public methods and constants to the module
for attr in dir(_geo_oa_impl):
    if not attr.startswith("_"):
        setattr(geo_oa, attr, getattr(_geo_oa_impl, attr))

# Also expose constants at module level
geo_oa.FEMORAL_WL_NORMAL_MAX = FEMORAL_WL_NORMAL_MAX
geo_oa.FEMORAL_WL_OA_MIN = FEMORAL_WL_OA_MIN
geo_oa.TIBIAL_HW_NORMAL_MIN = TIBIAL_HW_NORMAL_MIN
geo_oa.TIBIAL_HW_OA_MAX = TIBIAL_HW_OA_MAX
geo_oa.DEFAULT_VOXEL_SIZE_MM = DEFAULT_VOXEL_SIZE_MM
geo_oa.REFERENCE_RANGES = REFERENCE_RANGES
geo_oa.COLORS = COLORS

sys.modules["geo_oa"] = geo_oa
