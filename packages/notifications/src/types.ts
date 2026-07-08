import type { ReactElement } from "react";

export type RenderableEmail = {
	subject: string;
	element: ReactElement;
};

export type RenderedEmail = {
	subject: string;
	html: string;
	text: string;
};
