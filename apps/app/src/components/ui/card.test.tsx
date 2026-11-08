import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

afterEach(cleanup);

describe("Card", () => {
	test("is a group named by its title", () => {
		render(
			<Card>
				<CardHeader>
					<CardTitle>Password</CardTitle>
				</CardHeader>
				<CardContent>Body</CardContent>
			</Card>,
		);

		expect(
			screen.getByRole("group", {
				name: "Password",
			}).textContent,
		).toContain("Body");
	});

	test("is no group without a title", () => {
		render(<Card>Body</Card>);

		expect(screen.getByText("Body").hasAttribute("role")).toBe(false);
	});

	test("names nested cards by their own titles", () => {
		render(
			<Card>
				<CardTitle>Outer</CardTitle>
				<Card>
					<CardTitle>Inner</CardTitle>
				</Card>
			</Card>,
		);

		expect(
			screen
				.getByRole("group", {
					name: "Outer",
				})
				.contains(
					screen.getByRole("group", {
						name: "Inner",
					}),
				),
		).toBe(true);
	});
});
