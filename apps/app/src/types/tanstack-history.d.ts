declare module "@tanstack/history" {
	interface HistoryState {
		pendingMessage?: string;
		draft?: import("@/components/chat/chat-draft").ChatDraft;
		/** Tags a navigation made by a data table search. */
		dataTableSearch?: string;
	}
}
