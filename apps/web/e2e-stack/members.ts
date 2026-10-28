/** The members the stack tests sign in as: one per Playwright project, so their tries never mix. */
export const TEST_MEMBERS = {
  desktop: { phone: "01300000011", pin: "246813", nameBn: "পরীক্ষক এক", nameEn: "Tester One" },
  phone: { phone: "01300000012", pin: "246813", nameBn: "পরীক্ষক দুই", nameEn: "Tester Two" },
} as const;

export type TestMember = (typeof TEST_MEMBERS)[keyof typeof TEST_MEMBERS];

export function memberFor(projectName: string): TestMember {
  return projectName === "phone" ? TEST_MEMBERS.phone : TEST_MEMBERS.desktop;
}
