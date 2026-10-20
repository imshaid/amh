import type { FileRoutesByTo } from "../routeTree.gen";
import {
  IconClients,
  IconDashboard,
  IconIntake,
  IconLocation,
  IconOrders,
  IconPackage,
  IconReceivables,
} from "@/ui/icons";
import type { IconComponent } from "@/ui/icons";

type Section =
  "dashboard" | "orders" | "newOrder" | "receivables" | "clients" | "locations" | "packages";

export interface NavItem {
  to: keyof FileRoutesByTo;
  label: `nav.${Section}`;
  icon: IconComponent;
  /** Highlight only on this exact path, not on the pages below it. */
  exact: boolean;
}

export interface NavGroup {
  label: "nav.work" | "nav.directory";
  items: readonly NavItem[];
}

const dashboard: NavItem = { to: "/", label: "nav.dashboard", icon: IconDashboard, exact: true };
const orders: NavItem = { to: "/orders", label: "nav.orders", icon: IconOrders, exact: false };
const newOrder: NavItem = { to: "/new", label: "nav.newOrder", icon: IconIntake, exact: false };
const receivables: NavItem = {
  to: "/receivables",
  label: "nav.receivables",
  icon: IconReceivables,
  exact: false,
};
const clients: NavItem = { to: "/clients", label: "nav.clients", icon: IconClients, exact: false };
const locations: NavItem = {
  to: "/locations",
  label: "nav.locations",
  icon: IconLocation,
  exact: false,
};
const packages: NavItem = {
  to: "/packages",
  label: "nav.packages",
  icon: IconPackage,
  exact: false,
};

/** The main menu: the same sections and order as the approved prototype. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { label: "nav.work", items: [dashboard, orders, newOrder, receivables] },
  { label: "nav.directory", items: [clients, locations, packages] },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export interface BottomTab extends NavItem {
  /** The bottom bar is narrow: each tab has a one-word label. */
  short: "nav.short.home" | "nav.short.orders" | "nav.short.receivables";
}

/** The phone's bottom bar: Home, Orders, the centre New button, Receivables; More holds the rest. */
export const BOTTOM_BAR: {
  start: readonly BottomTab[];
  end: readonly BottomTab[];
  newOrder: NavItem;
  more: readonly NavItem[];
} = {
  start: [
    { ...dashboard, short: "nav.short.home" },
    { ...orders, short: "nav.short.orders" },
  ],
  end: [{ ...receivables, short: "nav.short.receivables" }],
  newOrder,
  more: [clients, locations, packages],
};
