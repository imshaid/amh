import type { FileRoutesByTo } from "../routeTree.gen";

type NavLabel =
  `nav.${"dashboard" | "orders" | "newOrder" | "receivables" | "clients" | "locations" | "packages"}`;

export interface NavItem {
  to: keyof FileRoutesByTo;
  label: NavLabel;
  /** Highlight only on this exact path, not on the pages below it. */
  exact: boolean;
}

export interface NavGroup {
  label: "nav.work" | "nav.directory";
  items: readonly NavItem[];
}

/** The main menu: the same sections and order as the approved prototype. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "nav.work",
    items: [
      { to: "/", label: "nav.dashboard", exact: true },
      { to: "/orders", label: "nav.orders", exact: false },
      { to: "/new", label: "nav.newOrder", exact: false },
      { to: "/receivables", label: "nav.receivables", exact: false },
    ],
  },
  {
    label: "nav.directory",
    items: [
      { to: "/clients", label: "nav.clients", exact: false },
      { to: "/locations", label: "nav.locations", exact: false },
      { to: "/packages", label: "nav.packages", exact: false },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
