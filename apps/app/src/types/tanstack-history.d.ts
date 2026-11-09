declare module "@tanstack/history" {
	interface HistoryState {
		/** The first message of a chat just created, sent once it opens. */
		pendingMessage?: import("@/components/chat/composer/chat-draft").ChatDraft;
		draft?: import("@/components/chat/composer/chat-draft").ChatDraft;
		/** Tags a navigation made by a data table search. */
		dataTableSearch?: string;
	}
}
