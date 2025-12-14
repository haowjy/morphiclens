# Format Matters: Evaluating Non‑JSON Tool Calling Formats for LLM‑Driven Editing and Code Execution

## 1. Motivation and Problem Statement

JSON has become the de facto standard for tool calling and structured output in LLM systems, largely for historical and infrastructure reasons (web APIs, existing parsers), not because it has been shown to be optimal for LLM reasoning. Recent work shows that **format constraints themselves can significantly degrade model performance on reasoning tasks** and introduce new failure modes that are orthogonal to the underlying task.

At the same time, practitioners observe that LLMs often behave more reliably when asked to produce **fenced executable blocks** such as:

```python
```
# code here
```
```

and similar custom forms like:

```text
```
# BIRF replacement rules here
```
```

Your own experiments suggest that such formats outperform JSON-based tool calls for both Python execution and string replacement.

**Goal:** Systematically evaluate whether **non‑JSON formats**—specifically BIRF and `[language]:run` fenced blocks—yield higher reliability and quality than JSON-based tool calling for (a) document editing and (b) code execution.

***

## 2. Research Questions and Hypotheses

### RQ1: Format vs. Reliability

**RQ1.1**: How does output format (JSON vs BIRF vs fenced command blocks) affect:

- Format compliance (is the output parseable)?
- Execution success (does the tool actually run without error)?
- Task success (does the document/code end up in the correct state)?

**H1**: For editing and code-execution tasks, **BIRF and `[language]:run` formats will significantly outperform JSON-based tool calls** on execution success and task success, especially on multi-step and multi-line edits.

This is motivated by work showing **10–60+ percentage point drops** in accuracy when LLMs are forced into JSON/structured output modes on reasoning tasks, despite near-zero parsing errors.[1][2]

### RQ2: Format vs. Reasoning Quality

**RQ2.1**: Does JSON-based tool calling reduce the quality of the *edits themselves* (e.g., clarity, coherence, correctness), even when they execute successfully?

**H2**: JSON formats will yield **lower text- and code-quality metrics** than BIRF and fenced formats, because they constrain the generation process and disrupt chain-of-thought, in line with findings that structured-output modes harm reasoning performance while offering limited benefit beyond parsing.[3][1]

### RQ3: Subjective Editing Tasks (“Make this better”)

**RQ3.1**: On inherently ambiguous instructions (e.g., “make this flow better”, “improve this story”), does format choice still matter once execution success is controlled for?

**H3**: Even when all formats can be parsed and applied, **BIRF/fenced formats will produce edits preferred by human or reward-model judges** more often than JSON formats, because they harmonize better with natural language reasoning and DSL-style generation.

This builds on instruction-based editing benchmarks that capture subjective edits (clarity, coherence, style) and show that multiple valid rewrites exist, making quality evaluation necessary beyond exact match.[4]

### RQ4: Model Sensitivity

**RQ4.1**: Are smaller or weaker models more sensitive to format choice than larger models?

**H4**: **Format effects will be larger on smaller models**, which have less capacity to juggle both reasoning and strict format compliance, echoing results that JSON constraints disproportionately hurt weaker models.[1]

***

## 3. Related Work (Condensed Literature Review)

1. **Format Restrictions Hurt Reasoning**  
   “Let Me Speak Freely?” systematically tests JSON/XML/YAML output modes and shows that forcing structured formats can cause **10–60 percentage point drops** on reasoning tasks like GSM8K and Last Letter, even when parsing errors are near zero. The root cause is disruption of chain-of-thought and key-ordering bias, not just syntax failures.[2][1]

2. **Tool Use Error Taxonomy**  
   ToolScan introduces a benchmark and taxonomy of tool-use errors (invalid format, wrong arguments, wrong function, etc.) and finds format-level failures (invalid JSON) are a major error class added by structured formats without improving underlying task competence.[5][6]

3. **Natural-Language Tool Calling (NLT)**  
   Recent work on natural language tool calling shows plain-English descriptions of tool use outperform JSON-based tool calls by roughly **+18–20 percentage points**, while using ~30% fewer tokens and reducing variance across models by ~70%. The key idea is to separate reasoning in natural language from structured tool invocation, instead of forcing both into JSON.[7][8]

4. **Grammar Prompting and DSLs**  
   Grammar prompting work shows LLMs can reliably learn domain-specific languages (DSLs) from 2–3 in-context examples when the syntax is simple and semantically meaningful. This supports the viability of BIRF as a compact DSL for editing instructions.[9]

5. **Structured Output and Constrained Decoding**  
   Work on constrained decoding (e.g., Domino-style methods) shows schema- and grammar-aware decoding can recover 100% schema compliance and avoid some naive JSON-mode pitfalls, but this does not solve the deeper issue that format constraints interfere with reasoning for generative tasks.[10][11][3]

6. **Instruction-Based Text Improvement Datasets**  
   EDITEVAL and related benchmarks provide instruction-based text improvement tasks (clarity, coherence, fluency, etc.), showing that ambiguous prompts like “improve this text” can be evaluated via multi-reference metrics and human or learned judges.[4]

Together, this literature motivates a focused study on **format choice** for LLM-driven editing and execution, rather than simply “improving JSON”.

***

## 4. Formats to Compare

You will evaluate at least four families of formats:

1. **JSON-based Tool Calling**
   - Platform-style function calling schemas (OpenAI-like).
   - Custom `str_replace` JSON tools (your own schema).
   - JSON-enclosed arguments for code execution (`{"code": "...", "language": "python"}`).

2. **BIRF inside Fenced Blocks**
   - ` ```str_replace:run` fenced block with BIRF rules, as in your example.
   - Single-line and multi-line rules (`::` delimiters, selectors, flags).

3. **Fenced Command Blocks**
   - ` ```
   - ` ```sed:run` containing sed-style substitution commands.

4. **Natural-Language Tool Descriptions**
   - Free-form textual descriptions of edits (“Use str_replace to change Finn to Arya in paragraphs and list items”) that your system parses with a separate component.

Each format has a clearly defined parser and execution semantics on your side; the LLM’s job is to produce *valid, executable instructions* in that format.

---

## 5. Task Design

### 5.1 Deterministic Tasks (Execution & Exactness)

- **Document Editing (Deterministic)**
  - Character renames (e.g., “Finn” → “Arya”).
  - Section title changes.
  - Targeted paragraph rewrites where a gold “after” version exists.

- **Code Editing & Execution**
  - Small code mutations where the expected behavior is specified via tests (like HumanEval-style tasks).
  - Document-transforming scripts (Python) or one-liner transformations (sed) that are executed on the input.

**Metrics:** binary success (did the edit/command run and produce the expected output?), syntax validity, and normalized edit distance to the target version.

### 5.2 Subjective / Ambiguous Editing

Using EDITEVAL-style tasks or your own synthetic corpus:

- “Make this passage flow better.”
- “Improve this dialogue.”
- “Tighten the pacing in this scene.”
- “Improve clarity while preserving meaning.”

For each, you have one or more reference rewrites or human/rater judgments to use as a benchmark.

**Metrics:** multi-reference similarity metrics (SARI, BERTScore, METEOR) and human or reward-model preferences on “which version is better.”

---

## 6. Evaluation Metrics

For each (model, format, task) triple, log:

1. **Format Compliance**
   - Parse success (boolean) for the produced format.
   - Error type (e.g., invalid JSON, malformed BIRF, invalid Python/sed).

2. **Execution Success**
   - Did the transformed document/code execute without runtime error?
   - For code, test harness pass/fail (pass@1).

3. **Task Success**
   - For deterministic tasks: exact or near-exact match (e.g., Levenshtein distance threshold).
   - For code tasks: all tests pass.

4. **Text/Code Quality**
   - Text: SARI, BERTScore, METEOR; optionally a small human eval slice.
   - Code: functional correctness + simple quality heuristics (e.g., no extraneous changes, style preserved).

5. **Efficiency**
   - Tokens in + out (per call).
   - Latency for generation + execution.

You then compare distributions of these metrics across formats, controlling for model and task type.

---

## 7. Experimental Design

### 7.1 Models

Test at least:

- One strong API model (e.g., GPT-4‑class).
- One mid-tier (gpt-4o-mini / similar).
- One open-source large model (e.g., Llama 3.x 70B or DeepSeek).
- One smaller open-source model (e.g., 7–8B).

This lets you test H4 (format effects are stronger on smaller models).

### 7.2 Conditions

For each task instance:

- Run **each format** as a separate condition, with:
  - Identical system instructions except for the format spec.
  - 0-shot vs few-shot variants (no examples vs 2–3 examples of the format).
  - Fixed low temperature for determinism (e.g., 0.2–0.3).

Total scale (example):  
N_tasks × N_formats × N_models × N_repeats, sized to your budget (e.g., 100–200 tasks per category).

---

## 8. Analysis Plan

- **Primary comparisons**: For each metric (format compliance, execution success, task success, quality), run mixed-effects models or ANOVA with format and model as factors.
- **Effect sizes**: Report format effect size vs. model effect size (does format matter as much as model choice?).
- **Error taxonomy**: Apply a ToolScan-style error classification to understand *where* each format fails (syntax vs semantics vs reasoning).
- **Ambiguous tasks**: On subjective tasks, compare human/reward-model preference rates across formats, controlling for execution success.

You explicitly test whether JSON-based tool calling is the worst-performing option once you look beyond just “does it parse?” and into “does it reason well and produce good edits?”.

---

## 9. Expected Contributions

1. **Empirical evidence that JSON harms reasoning-heavy tool use** in editing and execution, complementing existing general benchmarks.
2. **Demonstration that DSL-like formats (BIRF, fenced `[language]:run`) are more natural for LLMs**, aligning with grammar prompting and natural language tool calling results.
3. **A reusable evaluation harness and dataset** for format comparisons on document editing and code execution.
4. A clear, data-backed answer to your motivating question: **“Why JSON?” and whether we should move away from it for agentic editing workflows.**

If you want, the next step can be to turn this structure into a LaTeX or markdown skeleton for an actual submission (intro + related work + methods) that you can drop into a repo.

[1](https://aclanthology.org/2024.emnlp-industry.91.pdf)
[2](https://aclanthology.org/2024.emnlp-industry.91/)
[3](https://arxiv.org/html/2509.21791v1)
[4](https://aclanthology.org/2024.conll-1.7.pdf)
[5](https://arxiv.org/html/2411.13547v2)
[6](https://arxiv.org/abs/2411.13547)
[7](https://www.reddit.com/r/MachineLearning/comments/1o8szk0/r_plain_english_outperforms_json_for_llm_tool/)
[8](https://arxiv.org/html/2510.14453v1)
[9](https://arxiv.org/abs/2305.19234)
[10](https://arxiv.org/html/2403.06988v1)
[11](https://openai.com/index/introducing-structured-outputs-in-the-api/)