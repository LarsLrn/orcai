import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FilteredTrace } from "./export-chats";

const ExportChatsButton = ({ traces }: { traces: FilteredTrace[] }) => {
	const handleExport = () => {
		// Create a JSON blob from the traces
		const jsonData = JSON.stringify(traces, null, 2);
		const blob = new Blob([jsonData], { type: "application/json" });

		// Create a download link
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `chat-traces-${new Date().toISOString().split("T")[0]}.json`;

		// Trigger download
		document.body.appendChild(link);
		link.click();

		// Cleanup
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		// Show success toast
		toast.success("Chat history exported successfully!", {
			description: "Check your downloads folder.",
		});
	};

	return (
		<Button onClick={handleExport} className="gap-2">
			<Download className="h-4 w-4" />
			Export Chats (JSON)
		</Button>
	);
};

export { ExportChatsButton };
