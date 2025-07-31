import { useState } from "react";

export const useMessageEditor = () => {
	const [mode, setMode] = useState<"view" | "edit">("view");

	const toggleMode = () => {
		setMode(mode === "view" ? "edit" : "view");
	};

	const setViewMode = () => setMode("view");
	const setEditMode = () => setMode("edit");

	return {
		mode,
		toggleMode,
		setViewMode,
		setEditMode,
		isEditing: mode === "edit",
	};
};
