import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ComponentProps } from "react";
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block";
import { describeError } from "@/lib/errors/describe-error";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type ToolPart = ToolUIPart | DynamicToolUIPart;

const fieldLabelClassName =
	"mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-wide";

/** Raw values wrap instead of scrolling so the log stays readable when narrow. */
const ToolJson = ({ value }: { value: unknown }) => (
	<CodeBlock size="sm">
		<CodeBlockContent wrap className="wrap-anywhere">
			{typeof value === "string" ? value : JSON.stringify(value, null, 2)}
		</CodeBlockContent>
	</CodeBlock>
);

const ToolField = ({
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
	errorText?: ToolPart["errorText"];
};

export const ToolInput = ({ input, errorText }: ToolInputProps) => {
	if (input === undefined) {
		return (
			<ToolField label={m.ai_elements_tool_parameters_label()}>
				<p className="text-muted-foreground text-xs">
					{errorText
						? m.ai_elements_tool_parameters_invalid()
						: m.ai_elements_tool_parameters_empty()}
				</p>
			</ToolField>
		);
	}

	return (
		<ToolField label={m.ai_elements_tool_parameters_label()}>
			<ToolJson value={input} />
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
			<ToolField label={m.ai_elements_tool_error_label()}>
				<p className="wrap-anywhere text-destructive text-xs">
					{describeError(errorText)}
				</p>
			</ToolField>
		);
	}

	if (output === undefined) {
		return null;
	}

	return (
		<ToolField label={m.ai_elements_tool_result_label()}>
			<ToolJson value={output} />
		</ToolField>
	);
};
