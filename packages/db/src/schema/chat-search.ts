import { type SQLWrapper, sql } from "drizzle-orm";

/*
 * Chat search runs on expression indexes, so the database keeps them current
 * through every edit and regeneration. Queries must use these exact
 * expressions for the indexes to apply. `simple` keeps search language-neutral.
 */

export const chatTitleSearchVector = (title: SQLWrapper) =>
	sql`to_tsvector('simple', ${title})`;

const textParts = (parts: SQLWrapper) =>
	sql`jsonb_path_query_array(${parts}::jsonb, '$[*] ? (@.type == "text").text')`;

export const chatMessageSearchVector = (parts: SQLWrapper) =>
	sql`to_tsvector('simple', ${textParts(parts)})`;

/** The text the vector indexes, for headlines. */
export const chatMessageSearchText = (parts: SQLWrapper) =>
	sql<string>`(select string_agg(part, ' ') from jsonb_array_elements_text(${textParts(parts)}) as part)`;
