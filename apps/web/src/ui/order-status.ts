import { Constants } from "@/lib/database.gen";

/** An order's life (BLUEPRINT §4), plus the side exit: the database's own list, in order. */
export const ORDER_STATUSES = Constants.public.Enums.order_status;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
