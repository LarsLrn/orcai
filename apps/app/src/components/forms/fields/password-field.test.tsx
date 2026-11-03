import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	sharedSchemas,
} from "@orcai/schema";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { z } from "zod/v4";
import { useAppForm } from "@/hooks/form";
import { installZodErrorMap } from "@/lib/errors/zod-error-map";
import { m } from "@/paraglide/messages";

installZodErrorMap();

afterEach(cleanup);

const PasswordForm = ({ onSubmit }: { onSubmit: () => void }) => {
	const form = useAppForm({
		defaultValues: {
			password: "",
		},
		validators: {
			onSubmit: z.object({
				password: sharedSchemas.password,
			}),
		},
		onSubmit,
	});

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
		>
			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField label="Password" showLimits />
				)}
			/>
			<button type="submit">Submit</button>
		</form>
	);
};

const submitWith = async (password: string) => {
	fireEvent.change(screen.getByLabelText("Password"), {
		target: {
			value: password,
		},
	});
	await act(async () => {
		fireEvent.click(
			screen.getByRole("button", {
				name: "Submit",
			}),
		);
	});
};

describe("password field limits", () => {
	test("the hint names the configured minimum", () => {
		render(<PasswordForm onSubmit={mock()} />);

		expect(
			screen.getByText(new RegExp(`\\b${PASSWORD_MIN_LENGTH}\\b`)),
		).toBeTruthy();
	});

	test("a password below the minimum is refused", async () => {
		const onSubmit = mock();
		render(<PasswordForm onSubmit={onSubmit} />);

		await submitWith("a".repeat(PASSWORD_MIN_LENGTH - 1));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(
			screen.getByText(
				m.error_validation_string_too_small({
					minimum: PASSWORD_MIN_LENGTH,
				}),
			),
		).toBeTruthy();
	});

	test("a password at the minimum is accepted", async () => {
		const onSubmit = mock();
		render(<PasswordForm onSubmit={onSubmit} />);

		await submitWith("a".repeat(PASSWORD_MIN_LENGTH));

		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	test("a password at the maximum is accepted and one above is refused", async () => {
		const onSubmit = mock();
		render(<PasswordForm onSubmit={onSubmit} />);

		await submitWith("a".repeat(PASSWORD_MAX_LENGTH + 1));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(
			screen.getByText(
				m.error_validation_string_too_big({
					maximum: PASSWORD_MAX_LENGTH,
				}),
			),
		).toBeTruthy();

		await submitWith("a".repeat(PASSWORD_MAX_LENGTH));

		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
});
