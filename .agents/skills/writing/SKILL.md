---
name: writing
description: OrcAI house style for any prose or UI text people read. Use when writing or editing UI strings (en or de message catalogues, emails), docs pages, READMEs or PR bodies, and when reviewing such text for AI tells.
---

# Writing

OrcAI text is plain. It names the thing, says what happens and what the reader does, and stops. Readers are teachers, students, admins and operators, in English and German. They scan, so every sentence has to earn its place.

## Steps

1. Look up every domain noun in [`GLOSSARY.md`](../../../GLOSSARY.md) and use its word, in English and German. An _Avoid_ word or a second name for the same thing is a bug. Done when every domain noun in the text matches an entry.
2. Write to the rules below. German text also follows [`GERMAN.md`](GERMAN.md).
3. Read [`TELLS.md`](TELLS.md), then reread the text as a stranger who sees it for the first time. Mark every sentence that matches a tell or that the stranger would have to read twice. Done when every tell in the catalogue has been checked against the whole text.
4. Rewrite only the marked sentences and leave clean text alone, even where you would have phrased it differently. There are only so many ways to say that something failed. Keep every fact, add none. For a UI string, change `en.json` and `de.json` together and keep the key.
5. Check every fact the text states against the code: what the screen shows, what the button does, what the label says. The product is the source of truth, so where they disagree, change the text to describe the product. Done when every claim has been traced to the code or the running app.
6. Flag what text alone cannot fix, such as a UI description that only repeats its title (removing it is a code change), a missing string or a product behaviour that seems wrong. List the flags in your report or the PR body, and leave the code as it is.

## Rules

### Case

Headings, page titles, labels, buttons and menu items are in sentence case. Capitals go to the first word and to names: OrcAI, OrcAI Assistant, and the area names the glossary lists.

### Punctuation

Use full stops, commas, colons and parentheses. In every language, there is no em dash, en dash or spaced hyphen as punctuation, and no semicolon. Hyphens inside compounds are fine. Write ranges with "to" ("1 to 5"). A colon introduces a list or a value the reader asked for, never a reveal.

Two separate ideas get two sentences. Two closely linked halves (an action and its result, a rule and its reason) stay one sentence, joined with "and", "so", "but" or "because", or restructured. A full stop between them reads choppy.

### Voice

Use plain verbs such as "is", "has", "use", "show" and "add". The subject is whoever acts ("OrcAI prepares the file", "you can leave this page").

Stay calm. Leave out exclamation marks, "successfully", praise for the product, "simply" and "just". Never write "please" or "bitte", in any string, error or instruction, because the imperative alone is polite. A success toast states the new state ("Profile updated").

Say a thing in one place. Link the page or screen that owns it instead of restating it. End a section when its content ends, without a summary or an announcement of what comes next.

Write British English with "-ise" (organisation, summarise), except in code identifiers.

## UI strings

- A button or menu item is a verb plus its object, without a full stop ("Save metadata", "Remove from organisation").
- A confirmation title asks the question ("Delete this repository?"). Its description says what the reader loses or keeps, in full sentences.
- A description adds what the title cannot say. A description that only repeats its title gets flagged (step 6), not rewritten into new padding.
- Every toast has one shape. Loading is "Deleting the repository...", success "Repository deleted", and error "The repository was not deleted." with the server reason as the description. A toast in any other shape ("Failed to delete repository", "Could not delete the repository") is a tell to fix.
- An empty state says why the list is empty and what creates the first item.

## Docs pages

- Open with what the reader can do on that screen or with that feature, never with "This page describes".
- Headings name the task or the thing ("Upload assets", "Preparation states").
- Prose explains. Lists are for steps in order and for real enumerations of short, parallel items. Tables are for real matrices (states and their meaning, roles and their rights).
- Bold marks a literal UI label the reader will see on screen and nothing else, so terms, emphasis and lead-ins stay in plain text.
- Use the glossary term, and link the page that owns a concept instead of explaining it twice.
- Published pages carry no TODO callouts. Gaps go to an issue.

## Examples

From OrcAI's own text. Each fix removes a tell and keeps the facts.

| Tell | Before | After |
| --- | --- | --- |
| Semicolon between linked halves (`assets_metadata_generating_description`) | The utility model is reading the document. You can leave; the suggestion waits on the asset page. | The utility model is reading the file. You can leave this page, and the suggestion waits on the asset page. |
| Hype and exclamation (`account_profile_toast_success`) | Profile updated successfully! | Profile updated |
| Colon reveal (`access_visibility_description_public`) | Listed in the catalogue: every user of this instance can preview it. | Every user of this instance can preview it in the Catalogue. |
| Padding and "please" (`tour_chat_rating_content`) | Please assess each response you receive by using the buttons below. This will help to improve the bot, while it will not have a direct impact on your current chat. | Rate each answer with the buttons below it. Ratings help improve the bot and do not change this chat. |
| Chat register (`tour_initial_welcome_content`) | Let's take a quick tour through the app. Click "Next" to proceed. | This tour shows the main parts of OrcAI. Choose Next to continue. |
| Toast shape (`access_revoke_toast_error`) | Failed to revoke access | Access was not revoked. |
| Bold-label bullet (docs, Library page) | `- **After upload**: once a library upload is processed, its metadata is generated in the background.` | Once a Library upload is prepared, OrcAI writes its metadata in the background. |
| Label and reveal (docs) | Limits: up to 64 MB per file and 100 files per upload. | A file can be up to 64 MB, and one upload takes up to 100 files. |
| Signposting (docs) | A "What You Can Do" heading over nine bullets that name the page's own sections | The section is gone, since the headings already say it. |
| Nominalstil (`assets_prepare_again_confirm_description`) | Dadurch wird die Dokumentverarbeitung erneut ausgeführt und die Vektordaten aller angehängten Wissensdatenbanken werden aktualisiert. | OrcAI bereitet die Datei erneut vor und aktualisiert sie in allen Repositories, die sie enthalten. |
