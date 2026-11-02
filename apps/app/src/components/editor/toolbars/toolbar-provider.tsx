import { type Editor, useEditorState } from "@tiptap/react";
import { createContext, useContext } from "react";

interface ToolbarContextProps {
	editor: Editor;
}

const ToolbarContext = createContext<ToolbarContextProps | null>(null);

interface ToolbarProviderProps {
	editor: Editor;
	children: React.ReactNode;
}

export const ToolbarProvider = ({ editor, children }: ToolbarProviderProps) => {
	return (
		<ToolbarContext.Provider
			value={{
				editor,
			}}
		>
			{children}
		</ToolbarContext.Provider>
	);
};

export const useToolbar = () => {
	const context = useContext(ToolbarContext);

	if (!context) {
		throw new Error("useToolbar must be used within a ToolbarProvider");
	}

	return context;
};

/** Reads the editor for a toolbar control, kept current as the editor changes. */
export const useToolbarState = <T,>(selector: (editor: Editor) => T) => {
	const { editor } = useToolbar();

	return useEditorState({
		editor,
		selector: ({ editor: current }) => selector(current),
	});
};
