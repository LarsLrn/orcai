# Tells

Patterns that make text read as generated, in our own words. OrcAI's text has almost none of the famous words ("delve", "seamless"). Its tells are structural, so the structural group comes first and gets checked hardest. One structural hit is enough to rewrite. A single word-level hit is weak alone, so look for clusters.

## Structure

| Tell | What it looks like | Fix |
| --- | --- | --- |
| Bold-label bullets | A list where every item starts with a bold term and a colon, followed by a sentence | Prose, unless the items are steps or short parallel items. Bold only literal UI labels. |
| Label and reveal | A short label and a colon, then the actual statement ("Limits: up to 64 MB", "Listed in the catalogue: everyone can see it") | Say the statement directly. |
| Rule of three | Three adjectives, examples or clauses where the meaning has two parts or one | Count the real parts and write that many. |
| Signposting | "This section explains", "Here is how", "Let's take a look", a "What you can do" list that repeats the headings below it | Say the thing instead of announcing it. |
| Closing summary | A last sentence or section that restates what was just said ("In short", "Together, these settings", "That's it") | End when the content ends. |
| Heading echo | The first sentence under a heading repeats the heading | Start with the first new fact. |
| Title Case | Headings and labels such as "End-To-End Flow" | Sentence case. |
| Decorative structure | Small tables or nested lists that would read better as two sentences, headings over a single sentence | Prose. |
| Synonym rotation | One thing called by two or three names in a row (asset, document, file, material) | Repeat the glossary term. |

## Sentences

| Tell | What it looks like | Fix |
| --- | --- | --- |
| Not X but Y | A contrast that adds weight without a claim ("not just a list, but a living library") | State the claim. |
| Arguing with no one | Rejecting a view nobody raised ("This is not about control") | Delete it. |
| Staged run-up | A clause that delays the point ("The key thing to know is that...", "It's worth noting that") | Start with the point. |
| Riders | An "-ing" clause that inflates a plain fact ("..., ensuring a smooth experience") | Delete it, or make it a sentence with a real fact. |
| Avoiding "is" and "has" | "serves as", "acts as", "boasts", "features", "offers" | "is", "has". |
| Stacked hedges | "may potentially", "usually ... in most cases", "not necessarily always" | One qualifier, where it is true. |
| Vague authority | "Experts recommend", "best practice is", with no source | Give the reason or the source. |
| Inflated significance | Ordinary behaviour called key, powerful, crucial or a game changer | Describe the behaviour. |
| Dashes and semicolons | Clauses joined with a dash or a semicolon | Join linked halves with a conjunction, split only separate ideas. |
| Choppy splits | A bare full stop between an action and its result or a rule and its reason ("You can leave this page. We will email you.") | Join them with "and", "so" or "because". |
| Repeated openings | Three sentences in a row starting with the same subject or "You can" | Vary the subject or merge. |

## Register

| Tell | What it looks like | Fix |
| --- | --- | --- |
| Chat residue | "Great!", "Let's", "I hope this helps", "Feel free to", "Happy chatting" | Delete it. |
| Hype and exclamation | "successfully", "effortless", "seamless", "powerful", "!" in toasts | State what happened. |
| Politeness padding | "Please" or "bitte" anywhere, "We are pleased to" | The plain imperative or statement. |
| Meta about the text | Sentences about the document or the writer instead of the subject | Write about the subject. |
| Mixed toast shapes | "Failed to ...", "Could not ...", "X could not be ..." next to each other | Every error toast says "The X was not ...". |

## Leave alone

Quoted text, code, identifiers, paths, environment variables, legal text that a lawyer wrote, user-authored content, and model-facing text (system prompts, tool descriptions), which follows the prompting skill in `.agents/skills/prompting/`. A literal UI label quoted in the docs keeps its exact wording.

## Sources

The catalogue is our own wording, informed by these. Nothing is copied from the Wikipedia pages, which are CC BY-SA 4.0.

- blader/humanizer, `SKILL.md` v3.1.0 (MIT): https://github.com/blader/humanizer
- marmbiz/humanizer-de, `references/patterns.md` (MIT, with CC BY-SA 4.0 pattern material): https://github.com/marmbiz/humanizer-de
- Wikipedia, "Signs of AI writing" (CC BY-SA 4.0): https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
- Wikipedia (de), "Anzeichen für KI-generierte Inhalte" (CC BY-SA 4.0): https://de.wikipedia.org/wiki/Wikipedia:Anzeichen_f%C3%BCr_KI-generierte_Inhalte
