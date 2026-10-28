import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";

import { ProblemNote } from "@/app/data-states";
import { useFormat } from "@/i18n/hooks";
import { readWorkbook, WorkbookError } from "@/lib/xlsx/read-workbook";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { EditorPanel } from "@/ui/editor-panel";
import { IconSpinner, IconSpreadsheet, IconUpload } from "@/ui/icons";
import { Note } from "@/ui/note";
import { Tag } from "@/ui/tag";
import { toast } from "@/ui/toast/toast-store";

import { importPackageList, packageKeys } from "./api";
import type { ImportReport } from "./api";
import { parsePackageList } from "./package-list";
import type { ListIssue, ParsedPackageList } from "./package-list";
import { sharedRates } from "./price";

type Stage =
  | { kind: "choose"; fileError?: "notXlsx" | "tooLarge" }
  | { kind: "reading"; fileName: string }
  | { kind: "problems"; fileName: string; issues: ListIssue[] }
  | { kind: "review"; fileName: string; parsed: ParsedPackageList };

const ACCEPT = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Loads a package list from Excel (BLUEPRINT §5.7). The file is read and checked in the browser;
 * the server then says what would change, and only the member's confirmation applies it.
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { number } = useFormat();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>({ kind: "choose" });

  const check = useMutation({
    mutationFn: (parsed: ParsedPackageList) => importPackageList(parsed.list, false),
  });
  const apply = useMutation({
    mutationFn: (parsed: ParsedPackageList) => importPackageList(parsed.list, true),
    onSuccess: async (report) => {
      await queryClient.invalidateQueries({ queryKey: packageKeys.all });
      const created = report.packages.filter((entry) => entry.outcome === "new").length;
      const changed = report.packages.filter((entry) => entry.outcome === "changed").length;
      toast.show({
        tone: "success",
        title: t("packages.import.applied"),
        description: t("packages.import.appliedBody", {
          created: number(created),
          changed: number(changed),
        }),
      });
      close();
    },
  });

  function reset() {
    setStage({ kind: "choose" });
    check.reset();
    apply.reset();
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  async function readFile(file: File) {
    reset();
    setStage({ kind: "reading", fileName: file.name });
    let parsed: ParsedPackageList;
    try {
      parsed = parsePackageList(readWorkbook(new Uint8Array(await file.arrayBuffer())));
    } catch (error) {
      setStage({
        kind: "choose",
        fileError: error instanceof WorkbookError ? error.kind : "notXlsx",
      });
      return;
    }
    if (parsed.issues.length > 0) {
      setStage({ kind: "problems", fileName: file.name, issues: parsed.issues });
      return;
    }
    setStage({ kind: "review", fileName: file.name, parsed });
    check.mutate(parsed);
  }

  const report = stage.kind === "review" ? check.data : undefined;
  const changeCount = report
    ? report.packages.filter((entry) => entry.outcome !== "unchanged").length
    : 0;
  const categoriesChange = report
    ? report.categories.some((entry) => entry.outcome !== "unchanged")
    : false;

  return (
    <EditorPanel
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
      title={t("packages.import.title")}
      description={t("packages.import.lead")}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t("forms.cancel")}
          </Button>
          {stage.kind === "problems" || stage.kind === "review" ? (
            <Button onClick={reset} disabled={apply.isPending}>
              {t("packages.import.another")}
            </Button>
          ) : null}
          {stage.kind === "review" ? (
            <Button
              variant="primary"
              disabled={!report || (changeCount === 0 && !categoriesChange)}
              loading={apply.isPending}
              onClick={() => {
                apply.mutate(stage.parsed);
              }}
            >
              {changeCount > 0
                ? t("packages.import.apply", { count: changeCount, n: number(changeCount) })
                : t("forms.save")}
            </Button>
          ) : null}
        </>
      }
    >
      {stage.kind === "choose" ? (
        <ChooseFile
          fileError={stage.fileError}
          onFile={(file) => {
            void readFile(file);
          }}
        />
      ) : stage.kind === "reading" ? (
        <Working label={t("packages.import.reading")} />
      ) : stage.kind === "problems" ? (
        <FileProblems fileName={stage.fileName} issues={stage.issues} />
      ) : (
        <div className="flex flex-col gap-4">
          <FileSummary fileName={stage.fileName} parsed={stage.parsed} />
          {check.isPending ? <Working label={t("packages.import.checking")} /> : null}
          <ProblemNote error={check.error ?? apply.error} />
          {report ? <Review report={report} parsed={stage.parsed} /> : null}
        </div>
      )}
    </EditorPanel>
  );
}

function Working({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-2">
      <IconSpinner className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}

function ChooseFile({
  fileError,
  onFile,
}: {
  fileError: "notXlsx" | "tooLarge" | undefined;
  onFile: (file: File) => void;
}) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };
  return (
    <div className="flex flex-col gap-3">
      {fileError ? (
        <Note tone="error" role="alert">
          {t(fileError === "tooLarge" ? "packages.import.tooLarge" : "packages.import.notXlsx")}
        </Note>
      ) : null}
      {/* eslint-disable-next-line jsx-a11y-x/no-static-element-interactions -- Dropping a file is an extra for mouse users; the file button inside does the same for everyone. */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-150",
          dragging ? "border-brand bg-brand-soft" : "border-line-strong",
        )}
      >
        <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-6">
          <IconSpreadsheet aria-hidden="true" />
        </span>
        <label className="cursor-pointer">
          <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 font-semibold text-brand-ink hover:bg-brand-strong has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand coarse:h-11">
            <IconUpload className="size-4.5" aria-hidden="true" />
            {t("packages.import.choose")}
          </span>
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onFile(file);
            }}
          />
        </label>
        <p className="text-sm text-muted max-sm:hidden">{t("packages.import.dropHint")}</p>
      </div>
    </div>
  );
}

function FileSummary({ fileName, parsed }: { fileName: string; parsed: ParsedPackageList }) {
  const { t } = useTranslation();
  const { number } = useFormat();
  return (
    <p className="flex items-start gap-2 text-sm text-ink-2">
      <IconSpreadsheet className="mt-0.5 size-4.5 shrink-0 text-good" aria-hidden="true" />
      {t("packages.import.file", {
        name: fileName,
        packages: number(parsed.list.packages.length),
        categories: number(parsed.list.categories.length),
        items: number(parsed.itemCount),
      })}
    </p>
  );
}

function FileProblems({ fileName, issues }: { fileName: string; issues: readonly ListIssue[] }) {
  const { t } = useTranslation();
  const { number } = useFormat();
  const describe = (issue: ListIssue): string => {
    switch (issue.kind) {
      case "noPackageSheet":
        return t("packages.import.issues.noPackageSheet");
      case "missingColumn":
        return t("packages.import.issues.missingColumn", { column: issue.column });
      case "badRate":
        return t("packages.import.issues.badRate", {
          row: number(issue.row),
          name: issue.name,
          value: issue.value,
        });
      default:
        return t(`packages.import.issues.${issue.kind}`, {
          row: number(issue.row),
          name: issue.name,
        });
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-sm text-ink-2">
        <IconSpreadsheet className="mt-0.5 size-4.5 shrink-0 text-crit" aria-hidden="true" />
        {fileName}
      </p>
      <Note tone="error" role="alert">
        <p className="font-semibold">{t("packages.import.fileProblems")}</p>
        <ul className="mt-1.5 list-disc pl-4.5">
          {issues.map((issue, index) => (
            <li key={index}>{describe(issue)}</li>
          ))}
        </ul>
      </Note>
    </div>
  );
}

const OUTCOMES = ["new", "changed", "unchanged"] as const;
const OUTCOME_TONE = { new: "good", changed: "warn", unchanged: "neutral" } as const;

const CHANGES = ["rate", "items", "category", "notes", "name", "active"] as const;

function isKnownChange(change: string): change is (typeof CHANGES)[number] {
  return (CHANGES as readonly string[]).includes(change);
}

function Review({ report, parsed }: { report: ImportReport; parsed: ParsedPackageList }) {
  const { t } = useTranslation();
  const { money, number } = useFormat();
  const counts = {
    new: report.packages.filter((entry) => entry.outcome === "new").length,
    changed: report.packages.filter((entry) => entry.outcome === "changed").length,
    unchanged: report.packages.filter((entry) => entry.outcome === "unchanged").length,
  };
  const listed = report.packages.filter((entry) => entry.outcome !== "unchanged");
  const shared = [
    ...sharedRates(parsed.list.packages.map((entry) => ({ rate: entry.rate, active: true }))),
  ].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2" aria-label={t("packages.import.title")}>
        {OUTCOMES.map((outcome) => (
          <li key={outcome}>
            <Tag tone={OUTCOME_TONE[outcome]} className="px-2 text-sm leading-6">
              {t(`packages.import.outcomes.${outcome}`)}
              <span className="font-semibold tabular">{number(counts[outcome])}</span>
            </Tag>
          </li>
        ))}
      </ul>
      {listed.length === 0 ? (
        <Note tone="success">{t("packages.import.nothingToDo")}</Note>
      ) : (
        <ol className="flex flex-col rounded-lg border border-line">
          {listed.map((entry) => (
            <li
              key={entry.name}
              className="flex items-start justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="font-semibold">{entry.name}</p>
                {entry.outcome === "changed" ? (
                  <p className="text-sm text-ink-2">
                    {entry.changes
                      .filter(isKnownChange)
                      .map((change) =>
                        change === "rate" && entry.old_rate
                          ? `${t("packages.import.changes.rate")} ${money(entry.old_rate)} → ${money(entry.rate)}`
                          : t(`packages.import.changes.${change}`),
                      )
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="text-sm text-muted">{entry.category}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-semibold tabular">{money(entry.rate)}</span>
                <Tag tone={OUTCOME_TONE[entry.outcome]}>
                  {t(`packages.import.outcomes.${entry.outcome}`)}
                </Tag>
              </div>
            </li>
          ))}
        </ol>
      )}
      {listed.length > 0 && counts.unchanged > 0 ? (
        <p className="text-sm text-muted">
          {t("packages.import.unchangedHidden", {
            count: counts.unchanged,
            n: number(counts.unchanged),
          })}
        </p>
      ) : null}
      {shared.length > 0 ? (
        <Note>
          {t("packages.import.sharedPrices", {
            prices: shared.map((key) => money(key)).join(", "),
          })}
        </Note>
      ) : null}
      {parsed.withoutItems.length > 0 ? (
        <Note tone="warning">
          {t("packages.import.withoutItems", { names: parsed.withoutItems.join(", ") })}
        </Note>
      ) : null}
      {report.not_in_list.length > 0 ? (
        <Note>
          {t("packages.import.notInList", {
            names: report.not_in_list.map((entry) => entry.name).join(", "),
          })}
        </Note>
      ) : null}
    </div>
  );
}
