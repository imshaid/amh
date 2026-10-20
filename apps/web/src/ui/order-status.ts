/** An order's life (BLUEPRINT §4), plus the side exit. */
export const ORDER_STATUSES = [
  "draft",
  "confirmed",
  "delivering",
  "billed",
  "partlyPaid",
  "paid",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
