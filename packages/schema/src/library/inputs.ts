import { z } from "zod/v4";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import {
	libraryScopeSchema,
	librarySortSchema,
	publicationStatusFilterSchema,
} from "../shared/library";

export const libraryCountsInputSchema = z.object({
	...zedTokenSchema.shape,
	scope: libraryScopeSchema.default("all"),
	search: z.string().optional(),
});

export const libraryOverviewInputSchema = z.object({
	...zedTokenSchema.shape,
	scope: libraryScopeSchema.default("all"),
});

export const searchLibraryInputSchema = paginationInputSchema.extend({
	...zedTokenSchema.shape,
	search: z.string().optional(),
	scope: libraryScopeSchema.default("all"),
	/** Assets have no status: drafts leave them out. */
	status: publicationStatusFilterSchema.default("all"),
	sort: librarySortSchema.default("newest"),
});

export type LibraryCountsInput = z.infer<typeof libraryCountsInputSchema>;
export type LibraryOverviewInput = z.infer<typeof libraryOverviewInputSchema>;
export type SearchLibraryInput = z.infer<typeof searchLibraryInputSchema>;
