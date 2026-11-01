import { z } from "zod/v4";

/** What a library list shows: everything the user can read, or only what they can edit ("Mine"). */
export const libraryScopeSchema = z.enum([
	"all",
	"edit",
]);

/**
 * Published, drafts, or both. Drafts need edit; both shows published
 * resources the user can read and drafts they can edit.
 */
export const publicationStatusFilterSchema = z.enum([
	"ready",
	"draft",
	"all",
]);

/** Everything in the library, what the organisation made, or what it added from the catalogue. */
export const libraryOriginSchema = z.enum([
	"all",
	"own",
	"added",
]);

export const librarySortSchema = z.enum([
	"newest",
	"name",
]);

export type LibraryScope = z.infer<typeof libraryScopeSchema>;
export type PublicationStatusFilter = z.infer<
	typeof publicationStatusFilterSchema
>;
export type LibraryOrigin = z.infer<typeof libraryOriginSchema>;
export type LibrarySort = z.infer<typeof librarySortSchema>;

/** The kinds a library browses, one rail entry and one path each. */
export const libraryKindSchema = z.enum([
	"bot",
	"behaviour",
	"repository",
	"asset",
]);

export type LibraryKind = z.infer<typeof libraryKindSchema>;
