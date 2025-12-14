# MorphoLens: AI-Powered Scientific Analysis

Biomedical researchers face a frustrating barrier: quantitative image analysis often requires expensive commercial software (typically $10K–$50K+ per license) and months of specialized training. Labs without institutional budgets are locked out, so protocols that could accelerate research sit unused.

I built MorphoLens in Google AI Studio’s Build environment using Gemini 3 Pro, then extended the exported app with a browser-based Python stack (Pyodide) and React. Researchers describe what they want to analyze in plain language, and Gemini 3 Pro does the rest—understanding images, generating analysis code, and producing publication-ready measurements.

How it works:
- Load biomedical images and supporting documents (PDF/Markdown)
- Describe your analysis goal conversationally
- Gemini 3’s multimodal reasoning interprets the image and writes Python code
- The code runs instantly in-browser in a Pyodide stack (NumPy, scikit-image, OpenCV), with optional extra Python libraries installed via micropip and no backend or installation

A pluggable Role System packages supporting documents (prompts + Python helpers) into shareable “roles” that run as Python modules. The demo uses a 2D H&E-stained mouse knee joint section that previously required manual annotation in commercial software.

Technical stack:
- Gemini 3 Pro for multimodal image understanding and code generation
- Browser-based Python execution (Pyodide) for zero-setup analysis
- Role architecture for domain customization

Impact: Helps democratize quantitative analysis by giving researchers in resource-limited settings access to many of the same analytical capabilities as better-funded institutions. The architecture extends beyond biomedical; many workflows can be packaged as roles and shared.
