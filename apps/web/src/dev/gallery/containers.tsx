import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useFormat } from "@/i18n/hooks";
import { Button } from "@/ui/button";
import { Card, CardHeader } from "@/ui/card";
import { Dialog, DialogClose } from "@/ui/dialog";
import { Field } from "@/ui/field";
import {
  IconCancelled,
  IconDelivery,
  IconDocument,
  IconHistory,
  IconLock,
  IconPrint,
  IconSchedule,
  IconWarning,
} from "@/ui/icons";
import { Input } from "@/ui/input";
import { Note } from "@/ui/note";
import { Sheet } from "@/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Tag } from "@/ui/tag";
import { toast } from "@/ui/toast/toast-store";

import { SAMPLE_PACKAGES } from "./sample-data";
import { GallerySection, Specimen } from "./section";

export function CardsSection() {
  const { t } = useTranslation();
  const { money } = useFormat();
  return (
    <GallerySection
      id="cards"
      title={t("gallery.cards.title")}
      description={t("gallery.cards.body")}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader
            title={t("gallery.cards.panelTitle")}
            subtitle={t("gallery.cards.panelSubtitle")}
            actions={<Button size="sm">{t("gallery.cards.viewAll")}</Button>}
          />
          <p className="text-sm text-ink-2">{t("gallery.cards.panelBody")}</p>
        </Card>
        {SAMPLE_PACKAGES.map((item) => (
          <Card key={item.id} variant="interactive" className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="type-figure text-brand-strong">{money(item.rate)}</span>
              <Tag>{t(`gallery.chips.${item.category}`)}</Tag>
            </div>
            <p className="font-semibold">{item.name}</p>
            {item.sharedPrice ? (
              <Tag tone="warn" className="self-start">
                <IconWarning aria-hidden="true" />
                {t("gallery.chips.samePrice")}
              </Tag>
            ) : null}
            <ol className="list-decimal pl-4.5 text-sm text-ink-2">
              {item.items.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="inset">
          <CardHeader as="h3" title={t("gallery.cards.insetTitle")} className="mb-1.5" />
          <p className="text-sm text-ink-2">{t("gallery.cards.insetBody")}</p>
        </Card>
        <div className="flex flex-col gap-2">
          <Note>{t("gallery.notes.info")}</Note>
          <Note tone="locked">{t("gallery.notes.locked")}</Note>
          <Note tone="success">{t("gallery.notes.success")}</Note>
          <Note tone="warning">{t("gallery.notes.warning")}</Note>
          <Note tone="error">{t("gallery.notes.error")}</Note>
        </div>
      </div>
    </GallerySection>
  );
}

const ORDER_TABS = ["schedule", "challans", "bill", "datasheet", "history"] as const;

export function TabsSection() {
  const { t } = useTranslation();
  const { number } = useFormat();
  return (
    <GallerySection id="tabs" title={t("gallery.tabs.title")} description={t("gallery.tabs.body")}>
      <Card>
        <Tabs defaultValue="schedule">
          <TabsList aria-label={t("gallery.tabs.label")}>
            <TabsTrigger value="schedule" icon={IconSchedule}>
              {t("gallery.tabs.schedule")}
            </TabsTrigger>
            <TabsTrigger value="challans" icon={IconDocument} badge={number(28)}>
              {t("gallery.tabs.challans")}
            </TabsTrigger>
            <TabsTrigger value="bill" icon={IconLock}>
              {t("gallery.tabs.bill")}
            </TabsTrigger>
            <TabsTrigger value="datasheet" icon={IconDelivery}>
              {t("gallery.tabs.datasheet")}
            </TabsTrigger>
            <TabsTrigger value="history" icon={IconHistory}>
              {t("gallery.tabs.history")}
            </TabsTrigger>
          </TabsList>
          {ORDER_TABS.map((value) => (
            <TabsContent key={value} value={value}>
              <p className="text-ink-2">{t(`gallery.tabs.panels.${value}`)}</p>
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </GallerySection>
  );
}

/** Pretends to build a PDF batch, reporting progress the way the PDF service will. */
function useFakePdfJob() {
  const { t } = useTranslation();
  const running = useRef(false);
  return () => {
    if (running.current) return;
    running.current = true;
    const total = 28;
    const id = toast.show({
      title: t("gallery.overlays.pdfRunning"),
      tone: "info",
      progress: { done: 0, total },
    });
    let done = 0;
    const timer = setInterval(() => {
      done += 1;
      if (done < total) {
        toast.update(id, { progress: { done, total } });
        return;
      }
      clearInterval(timer);
      running.current = false;
      toast.update(id, {
        title: t("gallery.overlays.pdfDone"),
        tone: "success",
        progress: { done, total },
        duration: 5000,
      });
    }, 110);
  };
}

export function OverlaysSection() {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState("26");
  const [sheetOpen, setSheetOpen] = useState(false);
  const runPdfJob = useFakePdfJob();
  return (
    <GallerySection
      id="overlays"
      title={t("gallery.overlays.title")}
      description={t("gallery.overlays.body")}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Specimen label={t("gallery.overlays.dialog")}>
          <Dialog
            trigger={
              <Button variant="danger" className="self-start">
                <IconCancelled aria-hidden="true" />
                {t("gallery.overlays.cancelOrder")}
              </Button>
            }
            title={t("gallery.overlays.cancelTitle")}
            description={t("gallery.overlays.cancelDescription")}
            footer={
              <>
                <DialogClose asChild>
                  <Button>{t("gallery.overlays.keep")}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="danger"
                    onClick={() => {
                      toast.show({ title: t("gallery.overlays.cancelled"), tone: "warning" });
                    }}
                  >
                    {t("gallery.overlays.cancelOrder")}
                  </Button>
                </DialogClose>
              </>
            }
          >
            <p className="text-sm text-ink-2">{t("gallery.overlays.cancelBody")}</p>
          </Dialog>
          <p className="text-sm text-muted">{t("gallery.overlays.dialogHint")}</p>
        </Specimen>
        <Specimen label={t("gallery.overlays.sheet")}>
          <Sheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            trigger={<Button className="self-start">{t("gallery.overlays.openSheet")}</Button>}
            title={t("gallery.overlays.sheetTitle")}
            description={t("gallery.overlays.sheetDescription")}
            footer={
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => {
                  setSheetOpen(false);
                  toast.show({ title: t("gallery.overlays.saved") });
                }}
              >
                {t("gallery.overlays.save")}
              </Button>
            }
          >
            <Field label={t("gallery.forms.quantity")} hint={t("gallery.overlays.quantityHint")}>
              <Input
                inputMode="numeric"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                }}
                className="h-14 text-center font-display text-3xl coarse:h-14"
              />
            </Field>
          </Sheet>
          <p className="text-sm text-muted">{t("gallery.overlays.sheetHint")}</p>
        </Specimen>
        <Specimen label={t("gallery.overlays.toasts")}>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                toast.show({
                  title: t("gallery.overlays.successTitle"),
                  description: t("gallery.overlays.successBody"),
                });
              }}
            >
              {t("gallery.overlays.success")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                toast.show({
                  title: t("gallery.overlays.errorTitle"),
                  description: t("gallery.overlays.errorBody"),
                  tone: "error",
                  action: {
                    label: t("errors.unexpected.action"),
                    onAction: () => undefined,
                  },
                });
              }}
            >
              {t("gallery.overlays.error")}
            </Button>
            <Button size="sm" onClick={runPdfJob}>
              <IconPrint aria-hidden="true" />
              {t("gallery.overlays.job")}
            </Button>
          </div>
          <p className="text-sm text-muted">{t("gallery.overlays.toastHint")}</p>
        </Specimen>
      </div>
    </GallerySection>
  );
}
