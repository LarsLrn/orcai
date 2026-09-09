import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ToolPart = ToolUIPart | DynamicToolUIPart;

const fieldLabelClassName =
	"mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-wide";

/** Raw values wrap instead of scrolling so the log stays readable when narrow. */
export const ToolJson = ({ value }: { value: unknown }) => (
	<pre className="wrap-anywhere whitespace-pre-wrap rounded-md bg-background p-2 font-mono text-[0.6875rem] leading-relaxed">
		{typeof value === "string" ? value : JSON.stringify(value, null, 2)}
	</pre>
);

export const ToolField = ({
	label,
	className,
	children,
	...props
}: ComponentProps<"div"> & {
	label: string;
}) => (
	<div className={cn("min-w-0", className)} {...props}>
		<p className={fieldLabelClassName}>{label}</p>
		{children}
	</div>
);

export type ToolInputProps = {
	input: ToolPart["input"];
	rawInput?: unknown;
	errorText?: ToolPart["errorText"];
};

export const ToolInput = ({ input, rawInput, errorText }: ToolInputProps) => {
	const displayedInput = input ?? rawInput;
	const isRawInput = input == null && rawInput !== undefined;

	if (displayedInput === undefined) {
		return (
			<ToolField label="Parameters">
				<p className="text-muted-foreground text-xs">
					{errorText
						? "The call did not produce a valid parameter object."
						: "No parameters."}
				</p>
			</ToolField>
		);
	}

	return (
		<ToolField label={isRawInput ? "Raw parameters" : "Parameters"}>
			{isRawInput && (
				<p className="mb-1 text-muted-foreground text-xs">
					Showing the original arguments because validation failed.
				</p>
			)}
			<ToolJson value={displayedInput} />
		</ToolField>
	);
};

export type ToolOutputProps = {
	output: ToolPart["output"];
	errorText: ToolPart["errorText"];
};

export const ToolOutput = ({ output, errorText }: ToolOutputProps) => {
	if (errorText) {
		return (
			<ToolField label="Error">
				<p className="wrap-anywhere text-destructive text-xs">{errorText}</p>
			</ToolField>
		);
	}

	if (output === undefined) {
		return null;
	}

	return (
		<ToolField label="Result">
			<ToolJson value={output} />
		</ToolField>
	);
};
