import { useTranslation } from "react-i18next";

import { usePageTitle } from "@/app/shell/page-title-context";
import { PageHeader } from "@/ui/page-header";

import { ButtonsSection, ChipsSection, FormsSection } from "./controls";
import { CardsSection, OverlaysSection, TabsSection } from "./containers";
import { DataSection } from "./data";
import { FiguresSection, MotionSection } from "./figures";
import { ColorsSection, IconsSection, TypeSection } from "./foundations";
import { StatesSection } from "./states";

const SECTIONS = [
  "colors",
  "type",
  "icons",
  "buttons",
  "forms",
  "chips",
  "cards",
  "tabs",
  "overlays",
  "states",
  "data",
  "figures",
  "motion",
] as const;

/**
 * The design system in one place, for the owner's review of the look (BLUEPRINT §9, Segment 1) and
 * as a reference while building screens. Not in the menu; reach it at /dev/gallery or through the
 * command bar.
 */
export function GalleryPage() {
  const { t } = useTranslation();
  usePageTitle(t("nav.gallery"));
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t("gallery.eyebrow")}
        title={t("nav.gallery")}
        subtitle={t("gallery.intro")}
      />
      <nav
        aria-label={t("gallery.contents")}
        className="sticky top-15 z-20 -mx-4 [scrollbar-width:none] overflow-x-auto border-b border-line bg-bg/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-7 lg:px-7"
      >
        <ul className="flex gap-1.5">
          {SECTIONS.map((id) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-3 text-sm font-medium whitespace-nowrap text-ink-2 hover:border-line-strong hover:text-ink"
              >
                {t(`gallery.sections.${id}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <ColorsSection />
      <TypeSection />
      <IconsSection />
      <ButtonsSection />
      <FormsSection />
      <ChipsSection />
      <CardsSection />
      <TabsSection />
      <OverlaysSection />
      <StatesSection />
      <DataSection />
      <FiguresSection />
      <MotionSection />
    </div>
  );
}
