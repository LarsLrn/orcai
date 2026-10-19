declare module "@tanstack/history" {
	interface HistoryState {
		pendingMessage?: string;
		draft?: import("@/components/chat/chat-draft").ChatDraft;
	}
}
