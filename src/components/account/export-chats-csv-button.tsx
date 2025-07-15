import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { FilteredTrace } from "./export-chats";

interface ChatMessage {
	id: string;
	createdAt?: string;
	role: string;
	content: string;
	parts?: any[];
	annotations?: any[];
	revisionId?: string;
	isOutput?: boolean;
	traceId: string; // Track which trace this came from
}

interface CSVRow {
	session_id: string;
	trace_id: string;
	trace_timestamp: string;
	user_id: string;
	tags: string;
	latency: string;
	metadata_course_id: string;
	metadata_ai_prompt_format: string;
	system_prompt: string;
	message_sequence: string;
	message_id: string;
	message_created_at: string;
	message_role: string;
	message_content: string;
	message_parts_text: string;
	message_parts_raw: string;
	message_annotations: string;
	is_output_message: string;
	score_id: string;
	score_name: string;
	score_value: string;
	score_timestamp: string;
	score_comment: string;
	observations: string;
}

const ExportChatsCSVButton = ({ traces }: { traces: FilteredTrace[] }) => {
	const sanitizeForCSV = (value: any): string => {
		if (value === null || value === undefined) return "";

		const str = String(value);
		return str
			.replace(/\r\n/g, " ")
			.replace(/\n/g, " ")
			.replace(/\r/g, " ")
			.replace(/\t/g, " ")
			.replace(/"/g, '""')
			.trim();
	};

	const escapeCSVField = (value: string): string => {
		const needsQuotes =
			/[",\n\r\t]/.test(value) || value !== value.replace(/\s+/g, " ");
		return needsQuotes ? `"${value}"` : value;
	};

	const extractTextFromParts = (parts: any[]): string => {
		if (!Array.isArray(parts)) return "";

		return parts
			.filter((part) => part?.type === "text" && part?.text)
			.map((part) => sanitizeForCSV(part.text))
			.join(" ")
			.trim();
	};

	const deduplicateAndBuildConversations = (traces: FilteredTrace[]) => {
		// Group traces by session
		const sessionGroups = new Map<string, FilteredTrace[]>();
		traces.forEach((trace) => {
			const sessionId = trace.sessionId || "no-session";
			if (!sessionGroups.has(sessionId)) {
				sessionGroups.set(sessionId, []);
			}
			sessionGroups.get(sessionId)?.push(trace);
		});

		const conversationData: {
			sessionId: string;
			messages: ChatMessage[];
			traces: FilteredTrace[];
			systemPrompt: string;
			metadata: any;
			scoresByTraceId: Map<string, any[]>;
		}[] = [];

		sessionGroups.forEach((sessionTraces, sessionId) => {
			// Sort traces by timestamp to process in chronological order
			const sortedTraces = sessionTraces.sort(
				(a, b) =>
					new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
			);

			const uniqueMessages = new Map<string, ChatMessage>();
			const scoresByTraceId = new Map<string, any[]>();
			let systemPrompt = "";
			let metadata = {};

			sortedTraces.forEach((trace) => {
				// Extract system prompt and metadata from any trace (they should be consistent)
				if (trace.input?.system) {
					systemPrompt = trace.input.system;
				}
				if (trace.metadata) {
					metadata = { ...metadata, ...trace.metadata };
				}

				// Store scores by trace ID (scores are associated with the trace's output)
				if (trace.scores && trace.scores.length > 0) {
					scoresByTraceId.set(trace.id, trace.scores);
				}

				// Add messages from input.messages (deduplicated by ID)
				if (trace.input?.messages) {
					trace.input.messages.forEach(
						(msg: {
							id: string;
							content: any;
							parts: any[];
							createdAt: any;
							role: any;
							annotations: any;
							revisionId: any;
						}) => {
							if (msg.id && !uniqueMessages.has(msg.id)) {
								let content = sanitizeForCSV(msg.content);

								if (!content && msg.parts) {
									content = extractTextFromParts(msg.parts);
								}

								uniqueMessages.set(msg.id, {
									id: msg.id,
									createdAt: msg.createdAt,
									role: msg.role,
									content,
									parts: msg.parts,
									annotations: msg.annotations,
									revisionId: msg.revisionId,
									isOutput: false,
									traceId: trace.id,
								});
							}
						},
					);
				}

				// Add the output as a unique message (using trace ID as message ID)
				if (trace.output) {
					const outputId = `${trace.id}-output`;
					if (!uniqueMessages.has(outputId)) {
						uniqueMessages.set(outputId, {
							id: outputId,
							createdAt: trace.timestamp,
							role: "assistant",
							content: sanitizeForCSV(trace.output),
							isOutput: true,
							traceId: trace.id,
						});
					}
				}
			});

			// Sort messages by creation time
			const sortedMessages = Array.from(uniqueMessages.values()).sort(
				(a, b) => {
					const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
					const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
					return timeA - timeB;
				},
			);

			conversationData.push({
				sessionId,
				messages: sortedMessages,
				traces: sortedTraces,
				systemPrompt: sanitizeForCSV(systemPrompt),
				metadata,
				scoresByTraceId,
			});
		});

		return conversationData;
	};

	const convertToCSV = (data: FilteredTrace[]): string => {
		const csvRows: CSVRow[] = [];
		const conversations = deduplicateAndBuildConversations(data);

		conversations.forEach((conversation) => {
			const { sessionId, messages, traces, scoresByTraceId } = conversation;

			// Get representative trace data (use the latest trace for session-level info)
			const latestTrace = traces[traces.length - 1];

			const baseRow = {
				session_id: sanitizeForCSV(sessionId),
				user_id: sanitizeForCSV(latestTrace.userId),
				tags: sanitizeForCSV((latestTrace.tags || []).join(";")),
				metadata_course_id: sanitizeForCSV(conversation.metadata?.courseId),
				metadata_ai_prompt_format: sanitizeForCSV(
					conversation.metadata?.["ai.prompt.format"],
				),
				system_prompt: conversation.systemPrompt,
			};

			// If no messages, create one row with base data
			if (messages.length === 0) {
				csvRows.push({
					...baseRow,
					trace_id: sanitizeForCSV(latestTrace.id),
					trace_timestamp: sanitizeForCSV(latestTrace.timestamp),
					latency: sanitizeForCSV(latestTrace.latency?.toString()),
					observations: sanitizeForCSV(
						(latestTrace.observations || []).join(";"),
					),
					message_sequence: "",
					message_id: "",
					message_created_at: "",
					message_role: "",
					message_content: "",
					message_parts_text: "",
					message_parts_raw: "",
					message_annotations: "",
					is_output_message: "",
					score_id: "",
					score_name: "",
					score_value: "",
					score_timestamp: "",
					score_comment: "",
				});
				return;
			}

			// Process each message
			messages.forEach((message, messageIndex) => {
				// Find the trace that contains this message for trace-specific data
				const messageTrace =
					traces.find((t) => t.id === message.traceId) || latestTrace;

				let partsText = "";
				if (message?.parts) {
					partsText = extractTextFromParts(message.parts);
				}

				// Get scores only for assistant messages (role === 'assistant' or isOutput === true)
				const messageScores =
					message.role === "assistant" || message.isOutput
						? scoresByTraceId.get(message.traceId) || []
						: [];

				// If this is an assistant message with scores, create rows for each score
				if (messageScores.length > 0) {
					messageScores.forEach((score) => {
						csvRows.push({
							...baseRow,
							trace_id: sanitizeForCSV(messageTrace.id),
							trace_timestamp: sanitizeForCSV(messageTrace.timestamp),
							latency: sanitizeForCSV(messageTrace.latency?.toString()),
							observations: sanitizeForCSV(
								(messageTrace.observations || []).join(";"),
							),
							message_sequence: (messageIndex + 1).toString(),
							message_id: sanitizeForCSV(message.id),
							message_created_at: sanitizeForCSV(message.createdAt),
							message_role: sanitizeForCSV(message.role),
							message_content: sanitizeForCSV(message.content),
							message_parts_text: partsText,
							message_parts_raw: sanitizeForCSV(
								message.parts ? JSON.stringify(message.parts) : "",
							),
							message_annotations: sanitizeForCSV(
								message.annotations ? JSON.stringify(message.annotations) : "",
							),
							is_output_message: message.isOutput ? "true" : "false",
							score_id: sanitizeForCSV(score.id),
							score_name: sanitizeForCSV(score.name),
							score_value: sanitizeForCSV(score.value?.toString()),
							score_timestamp: sanitizeForCSV(score.timestamp),
							score_comment: sanitizeForCSV(score.comment),
						});
					});
				} else {
					// Create a single row for the message (with or without scores)
					csvRows.push({
						...baseRow,
						trace_id: sanitizeForCSV(messageTrace.id),
						trace_timestamp: sanitizeForCSV(messageTrace.timestamp),
						latency: sanitizeForCSV(messageTrace.latency?.toString()),
						observations: sanitizeForCSV(
							(messageTrace.observations || []).join(";"),
						),
						message_sequence: (messageIndex + 1).toString(),
						message_id: sanitizeForCSV(message.id),
						message_created_at: sanitizeForCSV(message.createdAt),
						message_role: sanitizeForCSV(message.role),
						message_content: sanitizeForCSV(message.content),
						message_parts_text: partsText,
						message_parts_raw: sanitizeForCSV(
							message.parts ? JSON.stringify(message.parts) : "",
						),
						message_annotations: sanitizeForCSV(
							message.annotations ? JSON.stringify(message.annotations) : "",
						),
						is_output_message: message.isOutput ? "true" : "false",
						score_id: "",
						score_name: "",
						score_value: "",
						score_timestamp: "",
						score_comment: "",
					});
				}
			});
		});

		// Convert to CSV format with proper escaping
		const headers = Object.keys(csvRows[0] || {});
		const csvContent = [
			headers.join(","),
			...csvRows.map((row) =>
				headers
					.map((header) => {
						const value = row[header as keyof CSVRow] || "";
						return escapeCSVField(value);
					})
					.join(","),
			),
		].join("\n");

		return csvContent;
	};

	const handleExport = () => {
		try {
			// Convert traces to CSV
			const csvData = convertToCSV(traces);
			const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });

			// Create a download link
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `chat-conversations-${new Date().toISOString().split("T")[0]}.csv`;

			// Trigger download
			document.body.appendChild(link);
			link.click();

			// Cleanup
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			// Show success toast
			toast.success("Chat conversations exported to CSV successfully!", {
				description: "Check your downloads folder.",
			});
		} catch (error) {
			console.error("Export failed:", error);
			toast.error("Failed to export chat conversations", {
				description: "Please try again.",
			});
		}
	};

	return (
		<div className="flex items-center gap-2">
			<Button onClick={handleExport} className="gap-2">
				<Download className="h-4 w-4" />
				Export Chats (CSV)
			</Button>

			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
					>
						<Info className="h-4 w-4" />
						<span className="sr-only">CSV format information</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-96" align="start">
					<div className="space-y-3">
						<div>
							<h4 className="mb-2 font-semibold text-sm">CSV Export Format</h4>
							<p className="text-muted-foreground text-sm">
								The exported CSV contains conversation data structured for
								analysis and processing.
							</p>
						</div>

						<div className="space-y-2">
							<h5 className="font-medium text-sm">Key Features:</h5>
							<ul className="space-y-1 text-muted-foreground text-sm">
								<li>
									• <strong>Delimiter:</strong> Comma-separated values
								</li>
								<li>
									• <strong>Encoding:</strong> UTF-8
								</li>
								<li>
									• <strong>Grouping:</strong> Messages grouped by session
								</li>
								<li>
									• <strong>Deduplication:</strong> Duplicate messages removed
								</li>
							</ul>
						</div>

						<div className="space-y-2">
							<h5 className="font-medium text-sm">Main Columns:</h5>
							<div className="space-y-1 text-muted-foreground text-sm">
								<div>
									<code className="rounded bg-muted px-1">session_id</code> -
									Conversation identifier
								</div>
								<div>
									<code className="rounded bg-muted px-1">message_role</code> -
									user/assistant/system
								</div>
								<div>
									<code className="rounded bg-muted px-1">message_content</code>{" "}
									- Text content
								</div>
								<div>
									<code className="rounded bg-muted px-1">
										message_sequence
									</code>{" "}
									- Order in conversation
								</div>
								<div>
									<code className="rounded bg-muted px-1">trace_timestamp</code>{" "}
									- When the message occurred
								</div>
							</div>
						</div>

						<div className="border-t pt-2">
							<p className="text-muted-foreground text-xs">
								Special characters are escaped and newlines converted to spaces
								for compatibility.
							</p>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
};

export { ExportChatsCSVButton };
