"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
	key: string;
	productId: string;
	productSlug: string;
	productName: string;
	image: string;
	variantId: string;
	variantLabel: string;
	unitPrice: number;
	quantity: number;
	pickupDateId: string;
	pickupDate: string;
	pickupWindow: string;
	cardMessages?: string[];
};

export type CardChoice = number | "all";

export function cardCountFor(card: CardChoice, boxes: number) {
	return card === "all" ? boxes : Math.min(boxes, Math.max(0, Math.floor(card)));
}

type CartValue = {
	lines: CartLine[];
	count: number;
	total: number;
	ready: boolean;
	setLineCard: (key: string, messages: string[]) => void;
	add: (line: Omit<CartLine, "key">) => void;
	remove: (key: string) => void;
	setQuantity: (key: string, quantity: number) => void;
	clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

function isCartLine(value: unknown): value is CartLine {
	if (!value || typeof value !== "object") return false;
	const line = value as Partial<CartLine>;
	return (
		typeof line.key === "string" &&
		typeof line.productId === "string" &&
		typeof line.productSlug === "string" &&
		typeof line.productName === "string" &&
		typeof line.image === "string" &&
		typeof line.variantId === "string" &&
		typeof line.variantLabel === "string" &&
		Number.isFinite(line.unitPrice) &&
		Number.isFinite(line.quantity) &&
		typeof line.pickupDateId === "string" &&
		typeof line.pickupDate === "string" &&
		typeof line.pickupWindow === "string"
	);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
	const [lines, setLines] = useState<CartLine[]>([]);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		queueMicrotask(() => {
			try {
				const stored: unknown = JSON.parse(localStorage.getItem("crumbie-cart") || "[]");
				setLines(
					Array.isArray(stored)
						? stored.filter(isCartLine).map((line) => ({
								...line,
								cardMessages: Array.isArray(line.cardMessages)
									? line.cardMessages.filter((m): m is string => typeof m === "string").slice(0, line.quantity)
									: undefined,
							}))
						: [],
				);
				localStorage.removeItem("crumbie-cart-card");
				localStorage.removeItem("crumbie-cart-card-messages");
			} catch {
				setLines([]);
			}
			setReady(true);
		});
	}, []);

	useEffect(() => {
		if (!ready) return;
		localStorage.setItem("crumbie-cart", JSON.stringify(lines));
	}, [lines, ready]);

	const value = useMemo<CartValue>(
		() => ({
			lines,
			count: lines.reduce((total, line) => total + line.quantity, 0),
			total: lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0),
			ready,
			setLineCard: (key, messages) =>
				setLines((current) =>
					current.map((line) => (line.key === key ? { ...line, cardMessages: messages.slice(0, line.quantity) } : line)),
				),
			add: (line) =>
				setLines((current) => {
					const key = `${line.variantId}:${line.pickupDateId}`;
					const found = current.find((item) => item.key === key);
					return found
						? current.map((item) =>
								item.key === key
									? {
											...item,
											quantity: Math.min(99, item.quantity + line.quantity),
											cardMessages: [...(item.cardMessages ?? []), ...(line.cardMessages ?? [])].slice(0, Math.min(99, item.quantity + line.quantity)),
										}
									: item,
							)
						: [...current, { ...line, key }];
				}),
			remove: (key) => setLines((current) => current.filter((line) => line.key !== key)),
			setQuantity: (key, quantity) =>
				setLines((current) =>
					current.map((line) =>
						line.key === key
							? (() => {
									const next = Number.isFinite(quantity) ? Math.min(99, Math.max(1, Math.floor(quantity))) : 1;
									return { ...line, quantity: next, cardMessages: line.cardMessages?.slice(0, next) };
								})()
							: line,
					),
				),
			clear: () => {
				setLines([]);
			},
		}),
		[lines, ready],
	);

	return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
	const value = useContext(CartContext);
	if (!value) throw new Error("CartProvider missing");
	return value;
}
