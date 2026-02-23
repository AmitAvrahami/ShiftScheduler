---
name: skill-creator
description: Create, improve, and evaluate Agent Skills following Anthropic's official best practices. Use when users want to create a new skill from scratch, improve an existing skill, write skill documentation, structure skill files, create evaluations, or follow skill authoring guidelines. Applies to Skills for claude.ai, API usage, and Agent SDK.
---

# Skill Creator

A comprehensive guide for creating high-quality Agent Skills that Claude can discover and use effectively.

## When to Use This Skill

Use this skill whenever the user needs help with:

- **Creating New Skills**: Designing Skills from scratch, defining scope and structure
- **Improving Existing Skills**: Refactoring, optimizing, making Skills more discoverable
- **Writing Skill Documentation**: SKILL.md files, reference documents, progressive disclosure
- **Creating Evaluations**: Building test cases to validate Skill effectiveness
- **Skill Architecture**: Organizing files, bundling resources, managing complexity
- **Following Best Practices**: Applying Anthropic's official skill authoring guidelines
- **Debugging Skill Issues**: Fixing discovery problems, improving Claude's navigation

## Core Principles of Effective Skills

### 1. Concise is Key

**The context window is a public good.** Your Skill shares context with:
- System prompt
- Conversation history
- Other Skills' metadata
- User's actual request

**Cost hierarchy:**
1. **Metadata (name + description)**: Pre-loaded for all Skills, always in context
2. **SKILL.md body**: Loaded when Skill is triggered
3. **Additional files**: Loaded only when referenced and needed

**Golden Rule**: Only add context Claude doesn't already have. Challenge every piece of information:
- "Does Claude really need this explanation?"
- "Can I assume Claude knows this?"
- "Does this paragraph justify its token cost?"

**Example - Concise (Good):**
```markdown
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
```

**Example - Too Verbose (Bad):**
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use and handles most cases well.
First, you'll need to install it using pip. Then you can use the code below...
```

**Assume Claude is already very smart.** Don't explain what PDFs are or how libraries work.

### 2. Set Appropriate Degrees of Freedom

Match specificity to the task's fragility and variability.

**High Freedom (Text-based instructions):**
- Multiple approaches are valid
- Decisions depend on context
- Heuristics guide approach

Example:
```markdown
## Code review process

1. Analyze code structure and organization
2. Check for potential bugs or edge cases
3. Suggest improvements for readability
4. Verify adherence to project conventions
```

**Medium Freedom (Pseudocode with parameters):**
- Preferred pattern exists
- Some variation acceptable
- Configuration affects behavior

Example:
```markdown
## Generate report

Use this template and customize as needed:

```python
def generate_report(data, format="markdown", include_charts=True):
    # Process data
    # Generate output in specified format
    # Optionally include visualizations
```
```

**Low Freedom (Specific scripts, few parameters):**
- Operations are fragile and error-prone
- Consistency is critical
- Specific sequence must be followed

Example:
```markdown
## Database migration

Run exactly this script:

```bash
python scripts/migrate.py --verify --backup
```

Do not modify the command or add additional flags.
```

**Analogy**: Think of Claude as exploring a path:
- **Narrow bridge with cliffs**: Provide specific guardrails (low freedom) - database migrations
- **Open field with no hazards**: Give general direction (high freedom) - code reviews

### 3. Test with All Target Models

Skills act as additions to models, so effectiveness depends on the underlying model.

**Testing considerations:**
- **Claude Haiku** (fast, economical): Does the Skill provide enough guidance?
- **Claude Sonnet** (balanced): Is the Skill clear and efficient?
- **Claude Opus** (powerful): Does the Skill avoid over-explaining?

What works for Opus might need more detail for Haiku. Aim for instructions that work across all target models.

## Skill Structure

### YAML Frontmatter (Required)

```yaml
---
name: skill-name-here
description: What the skill does and when to use it. Maximum 1024 characters. Must be specific and include trigger keywords.
---
```

**name field requirements:**
- Maximum 64 characters
- Lowercase letters, numbers, hyphens only
- No XML tags
- No reserved words: "anthropic", "claude"
- Use gerund form (verb + -ing) recommended: `processing-pdfs`, `analyzing-data`

**description field requirements:**
- Maximum 1024 characters
- Must be non-empty
- No XML tags
- **Write in third person** (injected into system prompt)
- Include both WHAT it does and WHEN to use it
- Be specific with key terms

### Naming Conventions

**Recommended: Gerund form (verb + -ing)**
- `processing-pdfs`
- `analyzing-spreadsheets`
- `managing-databases`
- `testing-code`
- `writing-documentation`

**Acceptable alternatives:**
- Noun phrases: `pdf-processing`, `spreadsheet-analysis`
- Action-oriented: `process-pdfs`, `analyze-spreadsheets`

**Avoid:**
- Vague: `helper`, `utils`, `tools`
- Generic: `documents`, `data`, `files`
- Reserved words: `anthropic-helper`, `claude-tools`

### Writing Effective Descriptions

**Critical for Skill Discovery**: The description enables Claude to choose the right Skill from 100+ available Skills.

**Always use third person:**
- ✓ Good: "Processes Excel files and generates reports"
- ✗ Bad: "I can help you process Excel files"
- ✗ Bad: "You can use this to process Excel files"

**Be specific and include triggers:**

**Good examples:**

```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

```yaml
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.
```

```yaml
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

**Bad examples:**

```yaml
description: Helps with documents
```

```yaml
description: Processes data
```

## Progressive Disclosure Patterns

SKILL.md serves as an overview that points Claude to detailed materials as needed.

**Guidelines:**
- Keep SKILL.md body under 500 lines for optimal performance
- Split content into separate files when approaching this limit
- Claude reads files on-demand (no context penalty until accessed)

### Pattern 1: High-Level Guide with References

```markdown
---
name: pdf-processing
description: Extracts text and tables from PDF files, fills forms, and merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## Quick start

Extract text with pdfplumber:
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Advanced features

**Form filling**: See [FORMS.md](FORMS.md) for complete guide
**API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
**Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
```

Claude loads FORMS.md, REFERENCE.md, or EXAMPLES.md only when needed.

### Pattern 2: Domain-Specific Organization

For Skills with multiple domains, organize by domain to avoid loading irrelevant context.

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

**SKILL.md:**
```markdown
# BigQuery Data Analysis

## Available datasets

**Finance**: Revenue, ARR, billing → See [reference/finance.md](reference/finance.md)
**Sales**: Opportunities, pipeline, accounts → See [reference/sales.md](reference/sales.md)
**Product**: API usage, features, adoption → See [reference/product.md](reference/product.md)
**Marketing**: Campaigns, attribution, email → See [reference/marketing.md](reference/marketing.md)

## Quick search

Find specific metrics using grep:

```bash
grep -i "revenue" reference/finance.md
grep -i "pipeline" reference/sales.md
```
```

### Pattern 3: Conditional Details

Show basic content, link to advanced:

```markdown
# DOCX Processing

## Creating documents

Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents

For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

### File Organization Best Practices

**Keep references one level deep from SKILL.md**
- ✓ Good: SKILL.md → advanced.md
- ✗ Bad: SKILL.md → advanced.md → details.md

**For long reference files (>100 lines), add table of contents:**
```markdown
# API Reference

## Contents
- Authentication and setup
- Core methods (create, read, update, delete)
- Advanced features (batch operations, webhooks)
- Error handling patterns
- Code examples

## Authentication and setup
...
```

**Use descriptive file names:**
- ✓ Good: `form_validation_rules.md`, `api_reference.md`
- ✗ Bad: `doc2.md`, `file1.md`

**Use forward slashes (Unix-style paths):**
- ✓ Good: `scripts/helper.py`, `reference/guide.md`
- ✗ Bad: `scripts\helper.py`, `reference\guide.md`

## Workflows and Feedback Loops

### Use Workflows for Complex Tasks

Break complex operations into clear, sequential steps. Provide checklists for tracking progress.

**Example: Research synthesis workflow:**

```markdown
## Research synthesis workflow

Copy this checklist and track your progress:

```
Research Progress:
- [ ] Step 1: Read all source documents
- [ ] Step 2: Identify key themes
- [ ] Step 3: Cross-reference claims
- [ ] Step 4: Create structured summary
- [ ] Step 5: Verify citations
```

**Step 1: Read all source documents**

Review each document in the `sources/` directory. Note the main arguments and supporting evidence.

**Step 2: Identify key themes**

Look for patterns across sources. What themes appear repeatedly? Where do sources agree or disagree?

**Step 3: Cross-reference claims**

For each major claim, verify it appears in the source material. Note which source supports each point.

**Step 4: Create structured summary**

Organize findings by theme. Include:
- Main claim
- Supporting evidence from sources
- Conflicting viewpoints (if any)

**Step 5: Verify citations**

Check that every claim references the correct source document. If citations are incomplete, return to Step 3.
```

### Implement Feedback Loops

**Common pattern: Run validator → fix errors → repeat**

This greatly improves output quality.

**Example: Document editing process:**

```markdown
## Document editing process

1. Make your edits to `word/document.xml`
2. **Validate immediately**: `python ooxml/scripts/validate.py unpacked_dir/`
3. If validation fails:
   - Review the error message carefully
   - Fix the issues in the XML
   - Run validation again
4. **Only proceed when validation passes**
5. Rebuild: `python ooxml/scripts/pack.py unpacked_dir/ output.docx`
6. Test the output document
```

## Content Guidelines

### Avoid Time-Sensitive Information

Don't include information that will become outdated.

**Bad (time-sensitive):**
```markdown
If you're doing this before August 2025, use the old API.
After August 2025, use the new API.
```

**Good (use "old patterns" section):**
```markdown
## Current method

Use the v2 API endpoint: `api.example.com/v2/messages`

## Old patterns

<details>
<summary>Legacy v1 API (deprecated 2025-08)</summary>

The v1 API used: `api.example.com/v1/messages`

This endpoint is no longer supported.
</details>
```

### Use Consistent Terminology

Choose one term and use it throughout:

**Good (consistent):**
- Always "API endpoint"
- Always "field"
- Always "extract"

**Bad (inconsistent):**
- Mix "API endpoint", "URL", "API route", "path"
- Mix "field", "box", "element", "control"
- Mix "extract", "pull", "get", "retrieve"

## Common Patterns

### Template Pattern

Provide templates for output format. Match strictness to needs.

**For strict requirements (API responses, data formats):**
```markdown
## Report structure

ALWAYS use this exact template structure:

```markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data
- Finding 3 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
```
```

**For flexible guidance (when adaptation is useful):**
```markdown
## Report structure

Here is a sensible default format, but use your best judgment:

```markdown
# [Analysis Title]

## Executive summary
[Overview]

## Key findings
[Adapt sections based on what you discover]

## Recommendations
[Tailor to the specific context]
```

Adjust sections as needed for the specific analysis type.
```

### Examples Pattern

Provide input/output pairs:

```markdown
## Commit message format

Generate commit messages following these examples:

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**Example 2:**
Input: Fixed bug where dates displayed incorrectly in reports
Output:
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```

Follow this style: type(scope): brief description, then detailed explanation.
```

### Conditional Workflow Pattern

Guide Claude through decision points:

```markdown
## Document modification workflow

1. Determine the modification type:

   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below

2. Creation workflow:
   - Use docx-js library
   - Build document from scratch
   - Export to .docx format

3. Editing workflow:
   - Unpack existing document
   - Modify XML directly
   - Validate after each change
   - Repack when complete
```

## Skills with Executable Code

### Solve, Don't Punt

When writing scripts, handle error conditions explicitly.

**Good (handles errors):**
```python
def process_file(path):
    """Process a file, creating it if it doesn't exist."""
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        print(f"File {path} not found, creating default")
        with open(path, "w") as f:
            f.write("")
        return ""
    except PermissionError:
        print(f"Cannot access {path}, using default")
        return ""
```

**Bad (punts to Claude):**
```python
def process_file(path):
    # Just fail and let Claude figure it out
    return open(path).read()
```

### Document Configuration Parameters

Avoid "voodoo constants" - document why values are chosen.

**Good (self-documenting):**
```python
# HTTP requests typically complete within 30 seconds
# Longer timeout accounts for slow connections
REQUEST_TIMEOUT = 30

# Three retries balances reliability vs speed
# Most intermittent failures resolve by the second retry
MAX_RETRIES = 3
```

**Bad (magic numbers):**
```python
TIMEOUT = 47  # Why 47?
RETRIES = 5  # Why 5?
```

### Provide Utility Scripts

Pre-made scripts offer advantages over generated code:
- More reliable
- Save tokens
- Save time
- Ensure consistency

**Example:**
```markdown
## Utility scripts

**analyze_form.py**: Extract all form fields from PDF

```bash
python scripts/analyze_form.py input.pdf > fields.json
```

Output format:
```json
{
  "field_name": {"type": "text", "x": 100, "y": 200},
  "signature": {"type": "sig", "x": 150, "y": 500}
}
```

**validate_boxes.py**: Check for overlapping bounding boxes

```bash
python scripts/validate_boxes.py fields.json
# Returns: "OK" or lists conflicts
```
```

Make clear whether Claude should:
- **Execute the script** (most common): "Run `analyze_form.py` to extract fields"
- **Read it as reference** (for complex logic): "See `analyze_form.py` for the algorithm"

### Create Verifiable Intermediate Outputs

Use "plan-validate-execute" pattern to catch errors early.

**Example workflow:**
1. Analyze → **create plan file** → **validate plan** → execute → verify
2. Validation catches problems before changes are applied
3. Machine-verifiable, reversible planning
4. Clear debugging with specific error messages

**When to use:**
- Batch operations
- Destructive changes
- Complex validation rules
- High-stakes operations

## Evaluation and Iteration

### Build Evaluations First

**Create evaluations BEFORE writing extensive documentation.**

**Evaluation-driven development:**
1. **Identify gaps**: Run Claude on tasks without a Skill. Document failures
2. **Create evaluations**: Build 3+ scenarios testing these gaps
3. **Establish baseline**: Measure performance without Skill
4. **Write minimal instructions**: Just enough to pass evaluations
5. **Iterate**: Execute, compare, refine

**Evaluation structure:**
```json
{
  "skills": ["pdf-processing"],
  "query": "Extract all text from this PDF file and save it to output.txt",
  "files": ["test-files/document.pdf"],
  "expected_behavior": [
    "Successfully reads the PDF file using appropriate tool",
    "Extracts text content from all pages",
    "Saves extracted text to output.txt in readable format"
  ]
}
```

### Develop Skills Iteratively with Claude

Most effective process involves Claude itself.

**Creating a new Skill:**
1. **Complete task without Skill**: Work through problem with Claude, noting repeated context
2. **Identify reusable pattern**: What context would help future similar tasks?
3. **Ask Claude to create Skill**: "Create a Skill that captures this pattern"
4. **Review for conciseness**: Remove unnecessary explanations
5. **Improve information architecture**: Organize into separate files if needed
6. **Test on similar tasks**: Use Skill with fresh Claude instance
7. **Iterate based on observation**: Refine based on what Claude B actually does

**Iterating on existing Skills:**
1. **Use Skill in real workflows**: Give Claude actual tasks, not test scenarios
2. **Observe behavior**: Note struggles, successes, unexpected choices
3. **Return to development Claude**: Share observations, ask for improvements
4. **Review suggestions**: Consider reorganization, stronger language, better structure
5. **Apply and test changes**: Update Skill, test with fresh instance
6. **Repeat**: Continue observe-refine-test cycle

**Why this works**: Claude understands agent needs, you provide domain expertise, testing reveals gaps through real usage.

## Anti-Patterns to Avoid

### Don't Use Windows-Style Paths

Always use forward slashes:
- ✓ Good: `scripts/helper.py`, `reference/guide.md`
- ✗ Bad: `scripts\helper.py`, `reference\guide.md`

### Don't Offer Too Many Options

Don't present multiple approaches unless necessary:

**Bad (too many choices):**
```markdown
You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or...
```

**Good (provide default with escape hatch):**
```markdown
Use pdfplumber for text extraction:
```python
import pdfplumber
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

### Don't Nest References Deeply

Keep all reference files one level deep from SKILL.md.

**Bad:**
```
SKILL.md → advanced.md → details.md → actual information
```

**Good:**
```
SKILL.md → advanced.md
SKILL.md → reference.md
SKILL.md → examples.md
```

## Technical Notes

### Runtime Environment

Skills run in code execution environment with:
- Filesystem access (bash commands, file reading)
- Code execution capabilities
- Package installation (claude.ai only)

**How Claude accesses Skills:**
1. **Metadata pre-loaded**: name + description in system prompt
2. **Files read on-demand**: SKILL.md loaded when triggered
3. **Scripts executed efficiently**: Output consumes tokens, not script content
4. **No context penalty**: Large files don't cost tokens until accessed

### Package Dependencies

**claude.ai**: Can install from npm and PyPI
**Anthropic API**: No network access, no runtime installation

List required packages and verify availability in code execution tool docs.

### MCP Tool References

Use fully qualified names to avoid "tool not found" errors.

**Format**: `ServerName:tool_name`

**Example:**
```markdown
Use the BigQuery:bigquery_schema tool to retrieve table schemas.
Use the GitHub:create_issue tool to create issues.
```

## Checklist for Effective Skills

Before sharing a Skill, verify:

### Core Quality
- [ ] Description is specific with key terms and triggers
- [ ] Description includes both what and when
- [ ] SKILL.md body under 500 lines
- [ ] Additional details in separate files (if needed)
- [ ] No time-sensitive information
- [ ] Consistent terminology throughout
- [ ] Examples are concrete
- [ ] File references one level deep
- [ ] Progressive disclosure used appropriately
- [ ] Workflows have clear steps

### Code and Scripts (if applicable)
- [ ] Scripts handle errors explicitly
- [ ] Error messages are helpful
- [ ] No "voodoo constants" (all values justified)
- [ ] Required packages listed
- [ ] Scripts have clear documentation
- [ ] All paths use forward slashes
- [ ] Validation steps for critical operations
- [ ] Feedback loops for quality checks

### Testing
- [ ] At least 3 evaluations created
- [ ] Tested with Haiku, Sonnet, Opus
- [ ] Tested with real usage scenarios
- [ ] Team feedback incorporated (if applicable)

## Creating a New Skill: Step-by-Step

When user asks you to create a new Skill, follow this process:

1. **Understand the domain**:
   - What task or capability does this Skill provide?
   - When should Claude use this Skill?
   - What are the key trigger words?

2. **Define the scope**:
   - What's included in this Skill?
   - What's explicitly excluded?
   - Are there related Skills that overlap?

3. **Create metadata**:
   - Choose descriptive name (gerund form recommended)
   - Write specific description with triggers
   - Verify name and description meet requirements

4. **Design the structure**:
   - Will SKILL.md be enough (<500 lines)?
   - Do you need separate reference files?
   - Are there utility scripts needed?

5. **Write content**:
   - Start with high-level overview
   - Provide concrete examples
   - Link to detailed references
   - Include workflows if multi-step

6. **Create evaluations**:
   - At least 3 test scenarios
   - Cover happy path and edge cases
   - Define expected behavior clearly

7. **Test and iterate**:
   - Test with different Claude models
   - Observe actual usage
   - Refine based on feedback

## Improving an Existing Skill

When user asks to improve a Skill:

1. **Analyze current state**:
   - Review SKILL.md structure
   - Check metadata quality
   - Assess file organization

2. **Identify issues**:
   - Is it discoverable? (description specific enough?)
   - Is it too verbose? (can content be condensed?)
   - Is navigation clear? (proper progressive disclosure?)
   - Are workflows helpful? (clear steps with validation?)

3. **Apply improvements**:
   - Refine description for better discovery
   - Condense verbose sections
   - Split large files using progressive disclosure
   - Add workflows for complex tasks
   - Improve error handling in scripts

4. **Test improvements**:
   - Run existing evaluations
   - Test with different models
   - Verify Claude can navigate effectively

## Conclusion

Creating effective Skills requires balancing:
- **Conciseness** vs. completeness
- **Freedom** vs. specificity
- **Structure** vs. simplicity
- **Documentation** vs. discovery

Follow these principles:
1. Assume Claude is smart - don't over-explain
2. Test early with evaluations
3. Iterate based on real usage
4. Keep SKILL.md concise, use progressive disclosure
5. Make descriptions specific with triggers
6. Provide workflows for complex tasks
7. Handle errors explicitly in scripts

The best Skills are discovered easily, navigated intuitively, and provide exactly the context Claude needs - no more, no less.
