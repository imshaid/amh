/*
 * Made-up records for the design gallery, shaped like real data from the server: money as exact
 * decimal strings, totals already computed. Names and phone numbers are fictional (the prototype's).
 * This is data, like database rows, not interface copy, so it is not translated.
 */

import type { OrderStatus } from "@/ui/order-status";

export interface SampleOrder {
  id: string;
  number: string;
  title: string;
  client: string;
  from: string;
  to: string;
  challans: number;
  total: string;
  status: OrderStatus;
}

export const SAMPLE_ORDERS: SampleOrder[] = [
  {
    id: "o47",
    number: "047",
    title: "অক্টোবর ট্রেনিং — পুরাতন হাসপাতাল",
    client: "REACTS-IN Project",
    from: "2026-10-22",
    to: "2026-10-23",
    challans: 2,
    total: "69270.00",
    status: "draft",
  },
  {
    id: "o46",
    number: "046",
    title: "অক্টোবর ইভেন্ট (PO PBD-2794325)",
    client: "REACTS-IN Project",
    from: "2026-10-29",
    to: "2026-10-29",
    challans: 1,
    total: "3735.00",
    status: "confirmed",
  },
  {
    id: "o45",
    number: "045",
    title: "অক্টোবর শিডিউল — নারগুন ইউনিয়ন",
    client: "Thakurgaon AP",
    from: "2026-10-06",
    to: "2026-10-31",
    challans: 66,
    total: "148960.00",
    status: "delivering",
  },
  {
    id: "o44",
    number: "044",
    title: "সেপ্টেম্বর শিডিউল — পৌরসভা",
    client: "Thakurgaon AP",
    from: "2026-09-07",
    to: "2026-09-14",
    challans: 46,
    total: "111880.00",
    status: "billed",
  },
  {
    id: "o43",
    number: "043",
    title: "সেপ্টেম্বর শিডিউল — বড়গাঁও, সেনুয়া, আউলিয়াপুর",
    client: "Thakurgaon AP",
    from: "2026-09-06",
    to: "2026-09-12",
    challans: 28,
    total: "102620.00",
    status: "partially_paid",
  },
  {
    id: "o42",
    number: "042",
    title: "আগস্ট ইভেন্ট — পুরাতন হাসপাতাল",
    client: "REACTS-IN Project",
    from: "2026-08-18",
    to: "2026-08-19",
    challans: 3,
    total: "69270.00",
    status: "paid",
  },
  {
    id: "o41",
    number: "041",
    title: "আগস্ট — বান্দিগড় ক্লাব ও দানারহাট",
    client: "Thakurgaon AP",
    from: "2026-08-13",
    to: "2026-08-16",
    challans: 3,
    total: "119750.00",
    status: "paid",
  },
  {
    id: "o40",
    number: "040",
    title: "ফোন অর্ডার — ৪৭+৩ প্যাকেট",
    client: "Others",
    from: "2026-08-12",
    to: "2026-08-12",
    challans: 1,
    total: "24880.00",
    status: "cancelled",
  },
];

/** What the server would send as the list's total. */
export const SAMPLE_ORDERS_TOTAL = "650365.00";

export interface SampleChallan {
  id: string;
  serial: number;
  date: string;
  location: string;
  contact: string;
  phone: string;
  packs: number;
}

const LOCATIONS = [
  ["কেশুরবাড়ি, বড়গাঁও", "রিনি", "01700-001214"],
  ["মেধাপাড়া, বড়গাঁও", "খুশি", "01700-002387"],
  ["সুজালি, বড়গাঁও", "প্রত্যাশা ও শিলা", "01700-003450"],
  ["সেনুয়া", "নুপুর", "01700-004126"],
  ["আউলিয়াপুর", "সাথী ও চন্দনা", "01700-005931"],
  ["কহরপাড়া LR সেন্টার", "খুশি ও রিনি", "01700-002387"],
] as const;

/** 300 challans, enough to show that long lists stay smooth. */
export const SAMPLE_CHALLANS: SampleChallan[] = Array.from({ length: 300 }, (_, index) => {
  const [location, contact, phone] = LOCATIONS[index % LOCATIONS.length] ?? LOCATIONS[0];
  return {
    id: `c${String(index + 1)}`,
    serial: index + 1,
    date: `2026-10-${String(6 + Math.floor(index / 12)).padStart(2, "0")}`,
    location,
    contact,
    phone,
    packs: 18 + ((index * 7) % 11),
  };
});

export const SAMPLE_CHALLANS_PACKS = SAMPLE_CHALLANS.reduce(
  (sum, challan) => sum + challan.packs,
  0,
);

/** Monthly billed and received, full months only (the running month is shown separately). */
export const BILLED_BY_MONTH = [
  320400, 412800, 258600, 341200, 486300, 214900, 362700, 289400, 391500, 442100, 382410,
];
export const RECEIVED_BY_MONTH = [
  238100, 265300, 352900, 219700, 290500, 402100, 181400, 301200, 246800, 331400, 368900, 31620,
];

export const SAMPLE_PACKAGES = [
  {
    id: "lb7",
    name: "Lunch Basic-07",
    category: "lunch",
    rate: "430",
    sharedPrice: true,
    items: [
      "Plain rice (Miniket / Najirshail) — 300 g ±",
      "Small fish bhuna — 150 g ±",
      "Seasonal vegetable fry — 100 g ±",
      "Egg bhuna — 1 pc",
      "Musur dal — 200 ml ±",
    ],
  },
  {
    id: "sb3",
    name: "Snacks Basic-03",
    category: "snacks",
    rate: "100",
    sharedPrice: false,
    items: [
      "Sliced fruit cake (Bonoful / Fulkoli) — 60 g ±",
      "Plum 6 pcs / Mango 1 pc / Lychee 5 pcs",
    ],
  },
] as const;
