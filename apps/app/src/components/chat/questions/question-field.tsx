import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { type ReactNode, useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "@/lib/ai/tools/questions/ask-user";
import { m } from "@/paraglide/messages";
import { type Draft, setOther, toggleChoice } from "./draft";

const OTHER = "other";

const optionRow =
	"flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5 has-focus-visible:border-ring";

/** An option with its control; `htmlFor` is the control's id. */
const OptionRow = ({
	htmlFor,
	control,
	children,
}: {
	htmlFor: string;
	control: ReactNode;
	children: ReactNode;
}) => (
	<Label htmlFor={htmlFor} className={optionRow}>
		{control}
		<span className="min-w-0 flex-1 font-normal">{children}</span>
	</Label>
);

/** The Other field of a regular round's choice question; typing in it chooses Other. */
const OtherInput = ({
	question,
	draft,
	onChange,
}: {
	question: Question;
	draft: Draft;
	onChange: (draft: Draft) => void;
}) => (
	<Input
		value={draft.other ?? ""}
		placeholder={m.questions_other_placeholder()}
		aria-label={m.questions_other_label()}
		onChange={(event) =>
			onChange(setOther(question, draft, event.target.value))
		}
		className="h-8"
	/>
);

/**
 * The control for one question: options to pick, Other in a regular round,
 * a text field or a scale. `onPicked` follows picking a single choice.
 */
export const QuestionField = ({
	question,
	withOther,
	draft,
	onChange,
	onPicked,
	labelledBy,
}: {
	question: Question;
	withOther: boolean;
	draft: Draft;
	onChange: (draft: Draft) => void;
	onPicked?: () => void;
	/** The id of the element that shows the prompt. */
	labelledBy: string;
}) => {
	const id = useId();

	switch (question.type) {
		case "single":
			return (
				<RadioGroup
					aria-labelledby={labelledBy}
					value={
						draft.other !== undefined
							? OTHER
							: draft.choices[0] !== undefined
								? String(draft.choices[0])
								: null
					}
					onValueChange={(value) => {
						if (value === OTHER) {
							onChange(setOther(question, draft, draft.other ?? ""));
							return;
						}
						onChange(toggleChoice(question, draft, Number(value)));
						onPicked?.();
					}}
					className="gap-2"
				>
					{question.options.map((option, index) => (
						<OptionRow
							key={`${index}-${option}`}
							htmlFor={`${id}-${index}`}
							control={
								<RadioGroupItem value={String(index)} id={`${id}-${index}`} />
							}
						>
							{option}
						</OptionRow>
					))}
					{withOther && (
						<OptionRow
							htmlFor={`${id}-${OTHER}`}
							control={<RadioGroupItem value={OTHER} id={`${id}-${OTHER}`} />}
						>
							<OtherInput
								question={question}
								draft={draft}
								onChange={onChange}
							/>
						</OptionRow>
					)}
				</RadioGroup>
			);
		case "multiple":
			return (
				<fieldset aria-labelledby={labelledBy} className="flex flex-col gap-2">
					{question.options.map((option, index) => (
						<OptionRow
							key={`${index}-${option}`}
							htmlFor={`${id}-${index}`}
							control={
								<Checkbox
									id={`${id}-${index}`}
									checked={draft.choices.includes(index)}
									onCheckedChange={() =>
										onChange(toggleChoice(question, draft, index))
									}
								/>
							}
						>
							{option}
						</OptionRow>
					))}
					{withOther && (
						<OptionRow
							htmlFor={`${id}-${OTHER}`}
							control={
								<Checkbox
									id={`${id}-${OTHER}`}
									checked={draft.other !== undefined}
									onCheckedChange={(checked) =>
										onChange(
											setOther(question, draft, checked ? "" : undefined),
										)
									}
									aria-label={m.questions_other_label()}
								/>
							}
						>
							<OtherInput
								question={question}
								draft={draft}
								onChange={onChange}
							/>
						</OptionRow>
					)}
				</fieldset>
			);
		case "text":
			return (
				<Textarea
					aria-labelledby={labelledBy}
					value={draft.text}
					placeholder={m.questions_text_placeholder()}
					onChange={(event) =>
						onChange({
							...draft,
							text: event.target.value,
						})
					}
				/>
			);
		case "scale": {
			const values = Array.from(
				{
					length: question.max - question.min + 1,
				},
				(_, index) => question.min + index,
			);
			return (
				<div className="flex flex-col gap-1.5">
					<RadioGroup
						aria-labelledby={labelledBy}
						aria-describedby={
							question.minLabel || question.maxLabel
								? `${id}-labels`
								: undefined
						}
						value={draft.value === undefined ? null : String(draft.value)}
						onValueChange={(value) =>
							onChange({
								...draft,
								value: Number(value),
							})
						}
						className="flex flex-wrap gap-1.5"
					>
						{values.map((value) => (
							<RadioPrimitive.Root
								key={value}
								value={String(value)}
								className="flex min-w-10 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm tabular-nums outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"
							>
								{value}
							</RadioPrimitive.Root>
						))}
					</RadioGroup>
					{(question.minLabel || question.maxLabel) && (
						<p
							id={`${id}-labels`}
							className="flex justify-between gap-4 text-muted-foreground text-xs"
						>
							<span>
								{question.minLabel &&
									m.questions_scale_label({
										value: question.min,
										label: question.minLabel,
									})}
							</span>
							<span>
								{question.maxLabel &&
									m.questions_scale_label({
										value: question.max,
										label: question.maxLabel,
									})}
							</span>
						</p>
					)}
				</div>
			);
		}
	}
};
