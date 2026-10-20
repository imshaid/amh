import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useFormat } from "@/i18n/hooks";
import { Button } from "@/ui/button";
import { Card, CardHeader } from "@/ui/card";
import { IconReceivables, IconRetry } from "@/ui/icons";
import { KpiTile } from "@/ui/kpi-tile";
import { Meter } from "@/ui/meter";
import type { MeterTone } from "@/ui/meter";
import { CountUp } from "@/ui/motion/count-up";
import { useFlash } from "@/ui/motion/flash";
import { Stagger, StaggerItem } from "@/ui/motion/stagger";
import { ProgressSteps } from "@/ui/progress-steps";
import { Sparkline } from "@/ui/sparkline";

import { BILLED_BY_MONTH, RECEIVED_BY_MONTH } from "./sample-data";
import { GallerySection, Specimen } from "./section";

const METER_TONES: { tone: MeterTone; value: number }[] = [
  { tone: "brand", value: 9 },
  { tone: "turmeric", value: 7 },
  { tone: "good", value: 12 },
  { tone: "warn", value: 4 },
  { tone: "crit", value: 2 },
];

export function FiguresSection() {
  const { t } = useTranslation();
  const { number } = useFormat();
  const steps = (["order", "delivery", "bill", "payment"] as const).map((id) => ({
    id,
    label: t(`ui.steps.names.${id}`),
  }));
  return (
    <GallerySection
      id="figures"
      title={t("gallery.figures.title")}
      description={t("gallery.figures.body")}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          hero
          icon={IconReceivables}
          label={t("gallery.figures.waiting")}
          value="238367.20"
          meta={t("gallery.figures.waitingMeta")}
        />
        <KpiTile
          label={t("gallery.figures.billed")}
          value="382410"
          trend={<Sparkline values={BILLED_BY_MONTH} />}
          delta={{
            percent: "13.5",
            direction: "down",
            favourable: false,
            comparison: t("gallery.figures.vsAugust"),
          }}
        />
        <KpiTile
          label={t("gallery.figures.received")}
          value="31620"
          trend={<Sparkline values={RECEIVED_BY_MONTH} tone="series-2" partialLast />}
          meta={t("gallery.figures.receivedMeta")}
        />
        <KpiTile
          label={t("gallery.figures.challans")}
          value={18}
          kind="number"
          suffix={`/ ${number(66)}`}
          trend={
            <Meter
              value={18}
              max={66}
              label={t("gallery.figures.challans")}
              valueText={t("ui.progressOf", { done: number(18), total: number(66) })}
              className="mt-1"
            />
          }
          meta={t("gallery.figures.challansMeta")}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Specimen label={t("gallery.figures.meters")}>
          <ul className="flex flex-col gap-3">
            {METER_TONES.map(({ tone, value }) => (
              <li
                key={tone}
                className="grid grid-cols-[5rem_minmax(0,1fr)_3rem] items-center gap-3"
              >
                <code className="font-mono text-xs text-muted">{tone}</code>
                <Meter
                  value={value}
                  max={12}
                  tone={tone}
                  label={tone}
                  valueText={t("ui.progressOf", { done: number(value), total: number(12) })}
                />
                <span className="text-right text-sm text-ink-2 tabular">
                  {number(value)}/{number(12)}
                </span>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen label={t("gallery.figures.sparklines")}>
          <div className="flex flex-wrap items-center gap-6">
            <Sparkline values={BILLED_BY_MONTH} />
            <Sparkline values={RECEIVED_BY_MONTH} tone="series-2" partialLast />
            <Sparkline values={BILLED_BY_MONTH.slice(4)} tone="series-3" />
          </div>
          <p className="text-sm text-muted">{t("gallery.figures.sparklineHint")}</p>
        </Specimen>
        <Specimen label={t("gallery.figures.steps")}>
          <div className="flex flex-col gap-3">
            {[0, 1, 3, 4].map((current) => (
              <ProgressSteps
                key={current}
                steps={steps}
                current={current}
                label={t("ui.steps.label")}
              />
            ))}
          </div>
        </Specimen>
      </div>
    </GallerySection>
  );
}

export function MotionSection() {
  const { t } = useTranslation();
  const { money, number } = useFormat();
  const [replay, setReplay] = useState(0);
  const [delivered, setDelivered] = useState(7);
  const flashRef = useFlash<HTMLLIElement>(delivered);
  return (
    <GallerySection
      id="motion"
      title={t("gallery.motion.title")}
      description={t("gallery.motion.body")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label={t("gallery.motion.entry")}>
          <Stagger key={replay} className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <StaggerItem
                key={index}
                className="h-14 rounded-lg border border-line bg-surface-2"
              />
            ))}
          </Stagger>
          <p className="type-figure">
            <CountUp key={replay} value="102620" kind="money" />
          </p>
          <Button
            size="sm"
            className="self-start"
            onClick={() => {
              setReplay((count) => count + 1);
            }}
          >
            <IconRetry aria-hidden="true" />
            {t("gallery.motion.replay")}
          </Button>
        </Specimen>
        <Card>
          <CardHeader
            title={t("gallery.motion.realtime")}
            subtitle={t("gallery.motion.realtimeHint")}
            actions={
              <Button
                size="sm"
                onClick={() => {
                  setDelivered((count) => (count >= 12 ? 7 : count + 1));
                }}
              >
                {t("gallery.motion.simulate")}
              </Button>
            }
          />
          <ul className="flex flex-col">
            <li ref={flashRef} className="flex flex-col gap-2 rounded-lg p-2">
              <span className="font-semibold">{t("gallery.motion.todayRoute")}</span>
              <Meter
                value={delivered}
                max={12}
                tone="turmeric"
                label={t("gallery.motion.todayRoute")}
                valueText={t("gallery.motion.deliveredOf", {
                  done: number(delivered),
                  total: number(12),
                })}
              />
              <span className="text-sm text-muted">
                {t("gallery.motion.deliveredOf", { done: number(delivered), total: number(12) })}
                {" · "}
                {money("8840")}
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </GallerySection>
  );
}
