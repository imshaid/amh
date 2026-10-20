import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, IconButton } from "@/ui/button";
import { Chip, ChipGroup } from "@/ui/chip";
import { ConfirmButton } from "@/ui/confirm-button";
import { Field } from "@/ui/field";
import {
  IconCopy,
  IconDelete,
  IconEdit,
  IconLock,
  IconPaid,
  IconPlus,
  IconPrint,
  IconSms,
  IconWarning,
} from "@/ui/icons";
import { Input, SearchInput, Textarea } from "@/ui/input";
import { ORDER_STATUSES } from "@/ui/order-status";
import { OrderStatusPill, Pill } from "@/ui/pill";
import { Select } from "@/ui/select";
import { Tag } from "@/ui/tag";
import { toast } from "@/ui/toast/toast-store";
import { useFormat } from "@/i18n/hooks";

import { GallerySection, Specimen } from "./section";

export function ButtonsSection() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  return (
    <GallerySection
      id="buttons"
      title={t("gallery.buttons.title")}
      description={t("gallery.buttons.body")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label={t("gallery.buttons.variants")}>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">
              <IconPlus aria-hidden="true" />
              {t("nav.newOrder")}
            </Button>
            <Button>
              <IconSms aria-hidden="true" />
              {t("actions.matchPayment")}
            </Button>
            <Button variant="ghost">
              <IconPrint aria-hidden="true" />
              {t("gallery.buttons.print")}
            </Button>
            <Button variant="danger">
              <IconDelete aria-hidden="true" />
              {t("gallery.buttons.delete")}
            </Button>
          </div>
        </Specimen>
        <Specimen label={t("gallery.buttons.sizes")}>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">{t("gallery.buttons.small")}</Button>
            <Button size="md">{t("gallery.buttons.medium")}</Button>
            <Button size="lg" variant="primary">
              {t("gallery.buttons.large")}
            </Button>
            <IconButton label={t("gallery.buttons.edit")} icon={IconEdit} />
            <IconButton
              label={t("gallery.buttons.copy")}
              icon={IconCopy}
              size="sm"
              variant="ghost"
            />
          </div>
        </Specimen>
        <Specimen label={t("gallery.buttons.states")}>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              loading={saving}
              onClick={() => {
                setSaving(true);
                setTimeout(() => {
                  setSaving(false);
                }, 1600);
              }}
            >
              <IconLock aria-hidden="true" />
              {saving ? t("gallery.buttons.issuing") : t("gallery.buttons.issue")}
            </Button>
            <Button disabled>{t("gallery.buttons.disabled")}</Button>
          </div>
        </Specimen>
        <Specimen label={t("gallery.buttons.confirm")}>
          <div className="flex flex-wrap items-center gap-3">
            <ConfirmButton
              confirmLabel={t("gallery.buttons.confirmAgain")}
              onConfirm={() => {
                toast.show({ title: t("gallery.buttons.deleted") });
              }}
            >
              <IconDelete aria-hidden="true" />
              {t("gallery.buttons.deletePage")}
            </ConfirmButton>
            <p className="text-sm text-muted">{t("gallery.buttons.confirmHint")}</p>
          </div>
        </Specimen>
      </div>
    </GallerySection>
  );
}

const CLIENTS = [
  { value: "ap", label: "Thakurgaon AP", description: "World Vision Bangladesh" },
  { value: "reacts", label: "REACTS-IN Project", description: "World Vision Bangladesh" },
  { value: "other", label: "—" },
] as const;

export function FormsSection() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("৪৩০");
  const [client, setClient] = useState<string | undefined>("ap");
  return (
    <GallerySection
      id="forms"
      title={t("gallery.forms.title")}
      description={t("gallery.forms.body")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label={t("gallery.forms.fields")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("gallery.forms.orderTitle")} required className="sm:col-span-2">
              <Input defaultValue={t("gallery.type.sampleTitle")} />
            </Field>
            <Field label={t("gallery.forms.client")}>
              <Select
                value={client}
                onValueChange={setClient}
                options={CLIENTS.map((option) => ({
                  ...option,
                  label: option.value === "other" ? t("gallery.forms.otherClient") : option.label,
                }))}
                placeholder={t("ui.choose")}
              />
            </Field>
            <Field label={t("gallery.forms.po")} hint={t("gallery.forms.poHint")}>
              <Input className="font-mono" defaultValue="PBD-2794325" />
            </Field>
            <Field
              label={t("gallery.forms.quantity")}
              error={t("gallery.forms.quantityError")}
              className="sm:col-span-2"
            >
              <Input inputMode="numeric" defaultValue="১০+" />
            </Field>
          </div>
        </Specimen>
        <Specimen label={t("gallery.forms.other")}>
          <div className="flex flex-col gap-4">
            <Field label={t("gallery.forms.search")}>
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder={t("gallery.forms.searchPlaceholder")}
              />
            </Field>
            <Field label={t("gallery.forms.sms")} hint={t("gallery.forms.smsHint")}>
              <Textarea className="font-mono text-sm" defaultValue={t("gallery.forms.smsSample")} />
            </Field>
            <Field label={t("gallery.forms.locked")}>
              <Input disabled defaultValue="AMH/26-27/B-0043" className="font-mono" />
            </Field>
          </div>
        </Specimen>
      </div>
    </GallerySection>
  );
}

const DAYS = ["all", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09"] as const;

export function ChipsSection() {
  const { t } = useTranslation();
  const { digits } = useFormat();
  const [status, setStatus] = useState("all");
  const [day, setDay] = useState<string>("all");
  return (
    <GallerySection
      id="chips"
      title={t("gallery.chips.title")}
      description={t("gallery.chips.body")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label={t("gallery.chips.filters")}>
          <ChipGroup
            value={status}
            onValueChange={setStatus}
            label={t("gallery.chips.statusFilter")}
          >
            <Chip value="all" count={10}>
              {t("gallery.chips.all")}
            </Chip>
            <Chip value="draft" count={1}>
              {t("status.order.draft")}
            </Chip>
            <Chip value="delivering" count={1}>
              {t("status.order.delivering")}
            </Chip>
            <Chip value="billed" count={3}>
              {t("gallery.chips.billed")}
            </Chip>
            <Chip value="paid" count={4}>
              {t("status.order.paid")}
            </Chip>
          </ChipGroup>
          <ChipGroup value={day} onValueChange={setDay} label={t("gallery.chips.dayFilter")}>
            {DAYS.map((value) => (
              <Chip key={value} value={value}>
                {value === "all"
                  ? t("gallery.chips.allDays")
                  : digits(`${value.slice(8)}/${value.slice(5, 7)}`)}
              </Chip>
            ))}
          </ChipGroup>
        </Specimen>
        <Specimen label={t("gallery.chips.tags")}>
          <div className="flex flex-wrap gap-2">
            <Tag>{t("gallery.chips.snacks")}</Tag>
            <Tag>{t("gallery.chips.lunch")}</Tag>
            <Tag tone="brand">{t("gallery.chips.union")}</Tag>
            <Tag tone="turmeric">{t("gallery.chips.today")}</Tag>
            <Tag tone="warn">
              <IconWarning aria-hidden="true" />
              {t("gallery.chips.samePrice")}
            </Tag>
          </div>
        </Specimen>
        <Specimen label={t("gallery.chips.statuses")} className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUSES.map((value) => (
              <OrderStatusPill key={value} status={value} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="good" icon={IconPaid}>
              {t("gallery.chips.exactMatch")}
            </Pill>
            <Pill tone="crit" icon={IconWarning}>
              {t("gallery.chips.mismatch")}
            </Pill>
          </div>
        </Specimen>
      </div>
    </GallerySection>
  );
}
