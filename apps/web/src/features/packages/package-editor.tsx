import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Controller, useFieldArray, useWatch } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { ProblemNote } from "@/app/data-states";
import { useProblemText } from "@/app/problem-text";
import { localName } from "@/features/directory/names";
import { useFormat, useLanguage } from "@/i18n/hooks";
import { problemOf } from "@/lib/data/problems";
import { FORM_ERRORS, useFieldError, useZodForm } from "@/lib/forms";
import { Button, IconButton } from "@/ui/button";
import { cn } from "@/ui/cn";
import { ConfirmButton } from "@/ui/confirm-button";
import { EditorPanel } from "@/ui/editor-panel";
import { Field } from "@/ui/field";
import { IconChevronDown, IconChevronUp, IconDelete, IconPlus } from "@/ui/icons";
import { Input, Textarea } from "@/ui/input";
import { Note } from "@/ui/note";
import { Select } from "@/ui/select";
import { toast } from "@/ui/toast/toast-store";

import { organisationsQuery } from "../clients/api";
import {
  addClientCode,
  categoriesQuery,
  createCategory,
  deletePackage,
  packageKeys,
  rateHistoryQuery,
  removeClientCode,
  savePackage,
  setPackageActive,
} from "./api";
import type { CategoryRow, PackageRow } from "./api";
import { itemStyleHints } from "./item-style";
import { parseRate, rateKey } from "./price";

const NEW_CATEGORY = "__new__";

const packageSchema = z.object({
  name: z.string().trim().min(1, FORM_ERRORS.required),
  categoryId: z
    .string()
    .min(1, FORM_ERRORS.required)
    .refine((value) => value !== NEW_CATEGORY, FORM_ERRORS.required),
  rate: z.string().transform((value, context) => {
    const rate = parseRate(value);
    if (rate === null) {
      context.addIssue({
        code: "custom",
        message: value.trim() === "" ? FORM_ERRORS.required : FORM_ERRORS.rate,
      });
      return z.NEVER;
    }
    return rate;
  }),
  items: z
    .array(
      z.object({
        en: z.string().trim().min(1, FORM_ERRORS.required),
        bn: z.string().trim(),
      }),
    )
    .min(1, FORM_ERRORS.itemsRequired),
  notes: z.string().trim(),
});

type PackageForm = z.input<typeof packageSchema>;

/** Adds a package or edits one: name, kind, price, item lines, notes; for an existing package also
 * its price history, the client's names for it, and switching it off or deleting it. */
export function PackageEditor({
  open,
  onOpenChange,
  item,
  packages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null adds a new package. */
  item: PackageRow | null;
  packages: readonly PackageRow[];
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <EditorPanel
      open={open}
      onOpenChange={onOpenChange}
      title={item ? t("packages.editor.editTitle") : t("packages.editor.newTitle")}
      description={item?.name}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("forms.cancel")}
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            {t("forms.save")}
          </Button>
        </>
      }
    >
      {open ? (
        <PackageForm
          key={item?.id ?? "new"}
          formId={formId}
          item={item}
          packages={packages}
          onBusyChange={setBusy}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      ) : null}
    </EditorPanel>
  );
}

function PackageForm({
  formId,
  item,
  packages,
  onBusyChange,
  onDone,
}: {
  formId: string;
  item: PackageRow | null;
  packages: readonly PackageRow[];
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const fieldError = useFieldError();
  const queryClient = useQueryClient();
  const categories = useQuery(categoriesQuery).data ?? [];
  const form = useZodForm(packageSchema, {
    name: item?.name ?? "",
    categoryId: item?.categoryId ?? "",
    rate: item ? item.rate.replace(/\.00$/, "") : "",
    items: item?.items.map((line) => ({ en: line.en, bn: line.bn ?? "" })) ?? [{ en: "", bn: "" }],
    notes: item?.notes ?? "",
  });
  const { register, control, formState, setError, setValue } = form;
  const categoryId = useWatch({ control, name: "categoryId" });

  const save = useMutation({
    mutationFn: (values: z.output<typeof packageSchema>) =>
      savePackage(item?.id ?? null, {
        name: values.name,
        categoryId: values.categoryId,
        rate: values.rate,
        items: values.items.map((line) =>
          line.bn ? { en: line.en, bn: line.bn } : { en: line.en },
        ),
        notes: values.notes,
      }),
    onMutate: () => {
      onBusyChange(true);
    },
    onSettled: () => {
      onBusyChange(false);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: packageKeys.all });
      toast.show({
        tone: "success",
        title: item ? t("packages.editor.saved") : t("packages.editor.created"),
      });
      onDone();
    },
    onError: (error) => {
      const problem = problemOf(error);
      if (problem.kind === "duplicate" && problem.constraint === "packages_name_key") {
        setError("name", { message: t("packages.editor.nameTaken") }, { shouldFocus: true });
      }
    },
  });
  const saveProblem =
    save.error && formState.errors.name?.message !== t("packages.editor.nameTaken")
      ? save.error
      : null;

  return (
    <div className="flex flex-col gap-5">
      {item && !item.active ? <Note tone="locked">{t("packages.editor.inactiveNote")}</Note> : null}
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            save.mutate(values);
          })(event);
        }}
      >
        <ProblemNote error={saveProblem} />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field
            label={t("packages.editor.name")}
            hint={t("packages.editor.nameHint")}
            error={fieldError(formState.errors.name)}
            required
          >
            <Input autoComplete="off" {...register("name")} />
          </Field>
          <Field
            label={t("packages.editor.rate")}
            error={fieldError(formState.errors.rate)}
            required
          >
            <Input
              inputMode="decimal"
              autoComplete="off"
              className="tabular"
              {...register("rate")}
            />
          </Field>
        </div>
        <SharedPriceNote control={control} item={item} packages={packages} />
        <Field
          label={t("packages.editor.category")}
          error={fieldError(formState.errors.categoryId)}
          required
        >
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
                placeholder={t("packages.editor.categoryPlaceholder")}
                options={[
                  ...categories.map((category) => ({
                    value: category.id,
                    label: localName(language, { en: category.nameEn, bn: category.nameBn }),
                  })),
                  { value: NEW_CATEGORY, label: `+ ${t("packages.editor.newCategory")}` },
                ]}
              />
            )}
          />
        </Field>
        {categoryId === NEW_CATEGORY ? (
          <NewCategoryFields
            categories={categories}
            onCreated={(id) => {
              setValue("categoryId", id, { shouldValidate: true });
            }}
          />
        ) : null}
        <ItemsEditor control={control} register={register} errors={formState.errors} />
        <Field
          label={`${t("packages.editor.notes")} ${t("forms.optional")}`}
          hint={t("packages.editor.notesHint")}
        >
          <Textarea className="min-h-16" {...register("notes")} />
        </Field>
        {item ? <p className="text-sm text-muted">{t("packages.editor.rateHint")}</p> : null}
      </form>
      {item ? (
        <>
          <RateHistory packageId={item.id} />
          <ClientCodes item={item} />
          <ManagePackage item={item} onDeleted={onDone} />
        </>
      ) : null}
    </div>
  );
}

/** When the typed price is another package's too, says so: orders will have to ask. */
function SharedPriceNote({
  control,
  item,
  packages,
}: {
  control: Control<PackageForm>;
  item: PackageRow | null;
  packages: readonly PackageRow[];
}) {
  const { t } = useTranslation();
  const { money } = useFormat();
  const typed = parseRate(useWatch({ control, name: "rate" }));
  if (typed === null) return null;
  const others = packages.filter(
    (other) => other.active && other.id !== item?.id && rateKey(other.rate) === rateKey(typed),
  );
  if (others.length === 0) return null;
  return (
    <Note tone="warning">
      {t("packages.editor.sharedWith", {
        names: others.map((other) => other.name).join(", "),
        price: money(typed),
      })}
    </Note>
  );
}

function NewCategoryFields({
  categories,
  onCreated,
}: {
  categories: readonly CategoryRow[];
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createCategory({
        nameEn: nameEn.trim(),
        nameBn: nameBn.trim(),
        sortOrder: Math.max(0, ...categories.map((category) => category.sortOrder)) + 1,
      }),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: packageKeys.categories });
      onCreated(id);
    },
  });
  const taken = create.error && problemOf(create.error).kind === "duplicate";
  const submit = () => {
    if (nameEn.trim() !== "") create.mutate();
  };
  const onEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("packages.editor.categoryNameEn")} required>
          <Input
            value={nameEn}
            onChange={(event) => {
              setNameEn(event.target.value);
            }}
            onKeyDown={onEnter}
          />
        </Field>
        <Field label={`${t("packages.editor.categoryNameBn")} ${t("forms.optional")}`}>
          <Input
            value={nameBn}
            onChange={(event) => {
              setNameBn(event.target.value);
            }}
            onKeyDown={onEnter}
          />
        </Field>
      </div>
      <ProblemNote
        error={create.error}
        {...(taken ? { message: t("packages.editor.categoryTaken") } : {})}
      />
      <Button
        size="sm"
        className="self-start"
        disabled={nameEn.trim() === ""}
        loading={create.isPending}
        onClick={submit}
      >
        <IconPlus aria-hidden="true" />
        {t("packages.editor.addCategory")}
      </Button>
    </div>
  );
}

function ItemsEditor({
  control,
  register,
  errors,
}: {
  control: Control<PackageForm>;
  register: UseFormRegister<PackageForm>;
  errors: FieldErrors<PackageForm>;
}) {
  const { t } = useTranslation();
  const { number } = useFormat();
  const fieldError = useFieldError();
  const { fields, append, remove, move } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const listError = errors.items?.root?.message ?? errors.items?.message;

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-ink-2">
        {t("packages.editor.items")}
        <span className="ml-1 text-crit-ink" aria-hidden="true">
          *
        </span>
      </legend>
      <p className="-mt-1 text-sm text-muted">{t("packages.editor.itemsHint")}</p>
      {listError ? (
        <p className="text-sm text-crit-ink" role="alert">
          {fieldError({ type: "min", message: listError })}
        </p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {fields.map((field, index) => {
          const n = number(index + 1);
          const hints = itemStyleHints(items[index]?.en ?? "");
          return (
            <li key={field.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink-2">
                  {t("packages.editor.line", { n })}
                </span>
                <div className="flex gap-1">
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={IconChevronUp}
                    label={t("packages.editor.moveUp", { n })}
                    disabled={index === 0}
                    onClick={() => {
                      move(index, index - 1);
                    }}
                  />
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={IconChevronDown}
                    label={t("packages.editor.moveDown", { n })}
                    disabled={index === fields.length - 1}
                    onClick={() => {
                      move(index, index + 1);
                    }}
                  />
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={IconDelete}
                    label={t("packages.editor.removeItem", { n })}
                    disabled={fields.length === 1}
                    onClick={() => {
                      remove(index);
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Field
                  label={t("packages.editor.itemEn")}
                  error={fieldError(errors.items?.[index]?.en)}
                >
                  <Input autoComplete="off" {...register(`items.${index}.en`)} />
                </Field>
                <Field label={`${t("packages.editor.itemBn")} ${t("forms.optional")}`}>
                  <Input autoComplete="off" lang="bn" {...register(`items.${index}.bn`)} />
                </Field>
              </div>
              {hints.length > 0 ? (
                <ul className="flex flex-col gap-0.5 text-sm text-warn-ink">
                  {hints.map((hint) => (
                    <li key={hint}>
                      {t(
                        hint === "separator"
                          ? "packages.editor.styleSeparator"
                          : hint === "units"
                            ? "packages.editor.styleUnits"
                            : "packages.editor.styleApprox",
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        onClick={() => {
          append({ en: "", bn: "" });
        }}
      >
        <IconPlus aria-hidden="true" />
        {t("packages.editor.addItem")}
      </Button>
    </fieldset>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="type-subheading">{title}</h3>
      {children}
    </section>
  );
}

function RateHistory({ packageId }: { packageId: string }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { money, date } = useFormat();
  const history = useQuery(rateHistoryQuery(packageId));
  if (!history.data || history.data.length === 0) return null;
  return (
    <Section title={t("packages.history.title")}>
      <ol className="flex flex-col">
        {history.data.map((change, index) => (
          <li
            key={change.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line py-2 last:border-b-0"
          >
            <span className={cn("font-semibold tabular", index === 0 && "text-brand-strong")}>
              {money(change.rate)}
              {index === 0 ? (
                <span className="ml-2 text-xs font-normal text-muted">
                  {t("packages.history.current")}
                </span>
              ) : null}
            </span>
            <span className="text-sm text-muted">
              {t("packages.history.since", { date: date(new Date(change.createdAt), "short") })}
              {change.by
                ? ` · ${t("packages.history.by", {
                    name:
                      language === "en" && change.by.nameEn ? change.by.nameEn : change.by.nameBn,
                  })}`
                : ""}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ClientCodes({ item }: { item: PackageRow }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const queryClient = useQueryClient();
  const organisations = useQuery(organisationsQuery).data ?? [];
  const [organisationId, setOrganisationId] = useState<string | undefined>(undefined);
  const [code, setCode] = useState("");
  const chosen = organisationId ?? organisations[0]?.id;
  const nameOf = (id: string) => {
    const organisation = organisations.find((entry) => entry.id === id);
    return organisation
      ? localName(language, { en: organisation.nameEn, bn: organisation.nameBn })
      : "";
  };
  const add = useMutation({
    mutationFn: () => {
      if (!chosen) throw new Error("No client chosen");
      return addClientCode({ packageId: item.id, organisationId: chosen, code: code.trim() });
    },
    onSuccess: async () => {
      setCode("");
      await queryClient.invalidateQueries({ queryKey: packageKeys.list });
    },
  });
  const remove = useMutation({
    mutationFn: removeClientCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: packageKeys.list }),
  });
  const taken = add.error && problemOf(add.error).kind === "duplicate";

  return (
    <Section title={t("packages.clientCodes.title")}>
      <p className="text-sm text-muted">{t("packages.clientCodes.hint")}</p>
      {item.clientCodes.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {item.clientCodes.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5"
            >
              <span className="min-w-0">
                <span className="block font-mono text-sm break-all">{entry.code}</span>
                <span className="text-xs text-muted">{nameOf(entry.organisationId)}</span>
              </span>
              <IconButton
                size="sm"
                variant="ghost"
                icon={IconDelete}
                label={t("packages.clientCodes.remove", { code: entry.code })}
                onClick={() => {
                  remove.mutate(entry.id);
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("packages.clientCodes.none")}</p>
      )}
      {organisations.length === 0 ? (
        <Note>{t("packages.clientCodes.noOrganisations")}</Note>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label={t("packages.clientCodes.organisation")} className="sm:w-48">
            <Select
              value={chosen}
              onValueChange={setOrganisationId}
              options={organisations.map((organisation) => ({
                value: organisation.id,
                label: localName(language, { en: organisation.nameEn, bn: organisation.nameBn }),
              }))}
            />
          </Field>
          <Field label={t("packages.clientCodes.code")} className="flex-1">
            <Input
              className="font-mono"
              autoComplete="off"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (code.trim() !== "") add.mutate();
                }
              }}
            />
          </Field>
          <Button
            disabled={code.trim() === ""}
            loading={add.isPending}
            onClick={() => {
              add.mutate();
            }}
          >
            <IconPlus aria-hidden="true" />
            {t("packages.clientCodes.add")}
          </Button>
        </div>
      )}
      <ProblemNote
        error={add.error ?? remove.error}
        {...(taken ? { message: t("packages.clientCodes.taken") } : {})}
      />
    </Section>
  );
}

function ManagePackage({ item, onDeleted }: { item: PackageRow; onDeleted: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const problemText = useProblemText();
  const toggle = useMutation({
    mutationFn: () => setPackageActive(item.id, !item.active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: packageKeys.list });
      toast.show({
        tone: "success",
        title: item.active ? t("packages.editor.switchedOff") : t("packages.editor.switchedOn"),
      });
    },
  });
  const remove = useMutation({
    mutationFn: () => deletePackage(item.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: packageKeys.list });
      toast.show({ tone: "success", title: t("packages.editor.deleted") });
      onDeleted();
    },
  });
  const error = toggle.error ?? remove.error;
  const inUse = remove.error && problemOf(remove.error).kind === "inUse";
  return (
    <Section title={t("directory.manage")}>
      <div className="flex flex-wrap gap-2">
        <Button
          loading={toggle.isPending}
          onClick={() => {
            toggle.mutate();
          }}
        >
          {item.active ? t("directory.switchOff") : t("directory.switchOn")}
        </Button>
        <ConfirmButton
          confirmLabel={t("directory.deleteConfirm")}
          loading={remove.isPending}
          onConfirm={() => {
            remove.mutate();
          }}
        >
          <IconDelete aria-hidden="true" />
          {t("directory.delete")}
        </ConfirmButton>
      </div>
      {error ? (
        <Note tone="error" role="alert">
          {inUse ? t("packages.editor.inUse") : problemText(error)}
        </Note>
      ) : null}
    </Section>
  );
}
