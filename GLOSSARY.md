# OrcAI

OrcAI lets organisations build bots that answer from their own material, share them with their members and list them for other organisations on the same instance. This glossary is the single source for the words the UI, emails and docs use, in English and German.

## Building bots

**Bot**:
A configured chat partner that answers with one behaviour, its repositories and its features.
_German_: Bot
_Avoid_: agent, assistant, chatbot

**Behaviour**:
A reusable block holding a system prompt and answer settings that decides how a bot writes.
_German_: Verhalten. Where German needs a plural or a count, Verhaltensvorgabe, pl. Verhaltensvorgaben
_Avoid_: AI behaviour, behaviour block, template, template block, KI-Verhalten, Verhaltensblock, Vorlage

**Repository**:
A reusable block holding assets that a bot or chat searches to ground and cite its answers.
_German_: Repository, pl. Repositories
_Avoid_: repository block, database block, knowledge base, retrieval database, content collection, Wissensdatenbank

**Block**:
The umbrella for behaviours and repositories, used only where both kinds are meant.
_German_: Block, pl. Blöcke
_Avoid_: building block, any compound ("behaviour block", "repository block", "Repository-Block")

**Feature**:
A built-in capability a bot or chat switches on: web search, questions and quizzes, generative UI.
_German_: Funktion
_Avoid_: built-in behaviour, tool

**Questions and quizzes**:
The feature that lets a bot ask the user structured questions and run quizzes it grades.
_German_: Fragen und Quiz, Quiz
_Avoid_: Questions & quizzes, Fragen & Quiz

**System prompt**:
The instructions inside a behaviour that the model reads before every answer.
_German_: System-Prompt

**Draft**, **Published**:
The two publication states of a bot or block. Only a published bot can be chatted with by others. The code value of Published is `ready`.
_German_: Entwurf, Veröffentlicht
_Avoid_: Ready (that is a preparation state)

**Publish**:
Move a bot or block from Draft to Published.
_German_: veröffentlichen
_Avoid_: list (that is the catalogue)

## Library and assets

**Library**:
The area that holds everything an organisation can use: what it made and what it added from the Catalogue. Capitalised as an area name.
_German_: Bibliothek
_Avoid_: Content Library, library (lower case)

**Asset**:
A file uploaded to OrcAI, with its metadata, kept in the Library and reusable in any number of repositories. Images are assets too. Inside a repository it is still an asset.
_German_: Asset, pl. Assets
_Avoid_: document, material, source material, content, content item, item, Dokument

**File**:
The uploaded original of an asset, as it was on the uploader's disk. Used for upload, download, file type and size, never for the asset itself.
_German_: Datei

**Chat upload**:
An asset uploaded with a chat message. The Library's default views leave it out, and the Assets view lists it under **Kept in** > **Chats** until someone adds it to the Library. Only then can it go into a repository.
_German_: Chat-Upload

**Metadata**:
The descriptive fields of an asset (title, description, language, source type, citation label and the type's own fields). The editor for them is opened with **Edit metadata**.
_German_: Metadaten
_Avoid_: source details, content (for the fields), Quellenangaben (for the form)

**Citation label**:
The full reference to an asset's source in APA 7 style, part of its metadata and shown with a citation.
_German_: Kurzbeleg
_Avoid_: Zitat, Zitatbezeichnung

**Preparation**:
Everything between upload and searchable: reading the file, describing images, indexing it in each repository. Running it once more is **Prepare again**.
_German_: Vorbereitung, vorbereiten, Erneut vorbereiten
_Avoid_: processing (as the umbrella), reprocess, ingestion, Verarbeitung (as the umbrella), Auftrag

**Queued**, **Processing**, **Indexing**, **Ready**, **Failed**:
The preparation states of an asset. Indexing exists only inside a repository.
_German_: In Warteschlange, Wird verarbeitet, Wird indiziert, Bereit, Fehlgeschlagen

**Retrieval**:
Finding the passages in a repository that match a question. A repository's retrieval mode sets how.
_German_: Abruf

**Passage**:
A piece of an asset after it is split for search. A bot retrieves passages and cites them. A repository sets how many it returns with **Passages per answer**.
_German_: Passage, pl. Passagen
_Avoid_: chunk, reference, references (for the count per answer), Verweis

**Citation**:
A marker in an answer that points to a source the chat retrieved, such as a passage and its asset.
_German_: Quellenangabe
_Avoid_: reference, Zitat, Verweis

**Source**:
What a bot answers from, and a cited asset or web page under an answer. Sources a bot is limited to are approved sources.
_German_: Quelle, geprüfte Quellen
_Avoid_: source for where a Library item comes from (that is origin), freigegebene Quellen

**Origin**:
Where something comes from. For a Library item, whether it was made in this organisation or added from the Catalogue. In the access overview, how someone has access: as a user, through a group or all members, inherited from a bot, block or the organisation, or because it is public.
_German_: Herkunft
_Avoid_: source

**Explore**:
Read a repository's passages or search them the way a bot does.
_German_: Durchsuchen

## Catalogue

**Catalogue**:
The instance-wide list of bots and blocks that organisations have listed for others. Capitalised as an area name.
_German_: Katalog
_Avoid_: catalogue (lower case), marketplace, gallery

**List**, **Listed**, **Not listed**:
Put a bot or block in the Catalogue, and the resulting state.
_German_: in den Katalog aufnehmen, Im Katalog, Nicht im Katalog
_Avoid_: publish, share, public, private

**Add from the Catalogue**:
Make a listed bot or block usable in your organisation. **Remove** undoes it.
_German_: aus dem Katalog hinzufügen, entfernen
_Avoid_: install, uninstall

**Home organisation**:
The organisation that made a bot or block and the only one that edits it.
_German_: Heimatorganisation

## Organisations and people

**Instance**:
One OrcAI installation with its own users and organisations.
_German_: Instanz
_Avoid_: platform, server, deployment

**Organisation**:
A group of members on an instance that owns bots, blocks, assets, providers and quota pools.
_German_: Organisation
_Avoid_: workspace, team, tenant, org, Arbeitsbereich

**User**:
An account on the instance, seen from the instance admin's side.
_German_: Benutzer
_Avoid_: Nutzer

**Member**:
A user who belongs to an organisation, with an organisation role. The organisation's page listing them is **Members**.
_German_: Mitglied
_Avoid_: user (for someone in an organisation)

**People**:
A mixed list of users and groups, as in the access dialog.
_German_: Personen

**Account**:
A user's own sign-in, profile and settings. A new one is made with **Create account**.
_German_: Konto, Konto erstellen
_Avoid_: register, sign up

**Sign in**, **Sign out**:
Start and end a session with an account.
_German_: Anmelden, Abmelden
_Avoid_: log in, log out

**Group**:
A set of members in one organisation that access is granted to at once. **All members** is the group every member is in.
_German_: Gruppe, Alle Mitglieder

**Invitation**:
An email offer to join an organisation with a role.
_German_: Einladung

## Roles and access

**Role**:
The set of rights a member has in an organisation, or a grant gives on one item.
_German_: Rolle

**Admin**, **Manager**, **Member**, **Viewer** (organisation roles):
What a member can do across the organisation. Viewers chat and read, members also create bots, blocks and assets, managers also run members, groups and catalogue additions, admins also configure providers, models, quota pools and the organisation.
_German_: Admin, Manager, Mitglied, Betrachter
_Avoid_: administrator

**Instance admin**:
A user who manages every organisation and user of the instance.
_German_: Instanz-Admin
_Avoid_: instance administrator

**Can view**, **Can edit**, **Can manage** (resource roles):
What a grant allows on one bot, block or asset.
_German_: Kann ansehen, Kann bearbeiten, Kann verwalten
_Avoid_: Viewer, Editor, Manager (those name organisation roles), Bearbeiter

**Resource**:
Not a user-facing word. Name the kind (bot, behaviour, repository, asset) or write "it".
_Avoid_: resource, Ressource

**Owner**:
The member a bot, block or asset belongs to.
_German_: Eigentümer

**Hand over**:
Make another member the owner of a bot, block or asset. Removing a member, making one a Viewer and deleting an account hand over what they own.
_German_: übergeben, „Übergeben an“ for the receiver
_Avoid_: transfer, übertragen

**Share**:
Give people or groups access to a bot, block or asset.
_German_: freigeben, Freigabe
_Avoid_: teilen, geteilt, publish, list

**Grant**:
One record of access: who (a user, a group or all members), on what, with which role. A direct grant is made on the item itself, as opposed to access inherited from a bot, a block or the organisation.
_German_: Freigabe

**Revoke**:
Remove a grant.
_German_: entziehen

**Access**:
Whether someone can see, use or change something.
_German_: Zugriff
_Avoid_: permission (for grants)

**Permission**:
An action an organisation role allows, such as creating bots.
_German_: Berechtigung

## Chat and the Assistant

**Chat**:
A thread of messages with a bot or with a model alone.
_German_: Chat
_Avoid_: thread, session, Gespräch

**Branch**:
A copy of a chat up to one message, linked to the chat it came from.
_German_: Zweig

**Pin**, **Unpin**:
Keep a chat at the top of the chat list.
_German_: Anheften, Lösen

**Favourite**:
Mark a bot to keep it at hand on Home and in the Library.
_German_: Favorit
_Avoid_: star, bookmark

**Attachment**:
A file or asset sent with a single chat message.
_German_: Anhang

**Work log**:
The list of steps a bot or the Assistant took for an answer.
_German_: Arbeitsprotokoll

**OrcAI Assistant**:
The built-in helper that sets up and manages OrcAI for the user through conversation. After the first mention on a page or screen, "the Assistant" with a capital A.
_German_: OrcAI Assistant, der Assistant
_Avoid_: assistant (for a bot or the model), Assistent

**Conversation**:
A thread with the OrcAI Assistant.
_German_: Unterhaltung
_Avoid_: chat (for Assistant threads)

**Tour**:
The guided walkthrough of a screen.
_German_: Tour
_Avoid_: Rundgang

## Models and quota

**Provider**:
A service that runs models or web search, connected with its endpoint and key.
_German_: Anbieter
_Avoid_: connection

**Model**:
A language model from a provider that an organisation has enabled.
_German_: Modell

**Chat model**:
The model a chat answers with.
_German_: Chat-Modell

**Default chat model**:
The organisation's model that new chats start on unless their bot or the person chooses another.
_German_: Standard-Chat-Modell

**Utility model**:
The organisation's model for background work: chat titles, image descriptions, metadata.
_German_: Hilfsmodell

**Assistant model**:
The model the OrcAI Assistant runs on.
_German_: Assistant-Modell

**Capability**:
Something a model can do, such as reading images or calling tools.
_German_: Fähigkeit

**Bot setup**:
The model and settings an organisation chooses for a bot, as recommended or required. The only thing called "setup". Making a new bot is **Create bot**.
_German_: Bot-Einrichtung
_Avoid_: setup for anything else

**Quota pool**:
A budget for model use that resets each period and covers some groups and models. After the first mention, "pool". The navigation and the index page say **Quota pools**.
_German_: Kontingent-Pool, Pool
_Avoid_: quota (alone, for the pool), Quotas, allowance, credits, Guthaben

**Budget**:
The amount a quota pool may spend per period. What is left of it is the remaining budget.
_German_: Budget, verbleibendes Budget

**Usage**:
What a person, bot or model consumed, in tokens or cost.
_German_: Nutzung

**Web search**:
A feature that lets a chat search the web, through a search provider or the model's own search, depending on the organisation's setting.
_German_: Websuche

**Search provider**:
A provider that runs web searches, when the organisation's web search setting uses one instead of the model's own search.
_German_: Suchanbieter

**Allowed domains**:
The host names web search is limited to, subdomains included. An empty list allows the whole web.
_German_: Erlaubte Domains

## Instance operations

**Health**:
The instance page that shows whether services, workers and checks are working.
_German_: Status

**Readiness checklist**:
The list of steps an organisation needs before chat works.
_German_: Checkliste zur Einrichtung
_Avoid_: setup checklist, Einrichtungs-Checkliste, "Organisation setup" as the name of the checklist
