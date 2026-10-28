import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useFormat, useLanguage } from "@/i18n/hooks";
import { memberName, signOut, useMember } from "@/lib/auth/membership";
import type { Member } from "@/lib/auth/membership";
import { formatPhone } from "@/lib/phone";
import { Avatar } from "@/ui/avatar";
import { cn } from "@/ui/cn";
import { IconPin, IconSelect, IconSignOut } from "@/ui/icons";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/ui/menu";

import { ChangePinDialog } from "./change-pin-dialog";

/** The signed-in member at the foot of the sidebar: their name, changing the PIN, signing out. */
export function SidebarMember({ className }: { className?: string }) {
  const member = useMember();
  if (!member) return null;
  return <SidebarMemberMenu member={member} className={className} />;
}

function SidebarMemberMenu({ member, className }: { member: Member; className?: string }) {
  const { t } = useTranslation();
  const { digits } = useFormat();
  const queryClient = useQueryClient();
  const name = memberName(member, useLanguage());
  const [changingPin, setChangingPin] = useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border border-line p-2 text-left transition-colors duration-150 hover:bg-surface-2",
              className,
            )}
            aria-label={t("member.menu", { name })}
          >
            <Avatar name={member.display_name_bn} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-ink">{name}</span>
              <span className="truncate font-mono text-xs text-muted">
                {digits(formatPhone(member.phone))}
              </span>
            </span>
            <IconSelect className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width)">
          <MenuLabel>{t("member.signedInAs", { name })}</MenuLabel>
          <MenuItem
            onSelect={() => {
              setChangingPin(true);
            }}
          >
            <IconPin aria-hidden="true" />
            {t("member.changePin.action")}
          </MenuItem>
          <MenuItem
            onSelect={() => {
              void signOut(queryClient);
            }}
          >
            <IconSignOut aria-hidden="true" />
            {t("member.signOut")}
          </MenuItem>
        </MenuContent>
      </Menu>
      <ChangePinDialog open={changingPin} onOpenChange={setChangingPin} />
    </>
  );
}

/** The member's part of the phone's More sheet. */
export function SheetMember({ onAction }: { onAction: () => void }) {
  const { t } = useTranslation();
  const { digits } = useFormat();
  const queryClient = useQueryClient();
  const member = useMember();
  const language = useLanguage();
  const [changingPin, setChangingPin] = useState(false);
  if (!member) return null;
  const name = memberName(member, language);
  const rowClasses =
    "flex h-13 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-ink hover:bg-surface-2";
  return (
    <section aria-label={t("member.section")} className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-3 px-3 pb-2">
        <Avatar name={member.display_name_bn} className="size-10 text-base" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate font-mono text-sm text-muted">
            {digits(formatPhone(member.phone))}
          </p>
        </div>
      </div>
      <button
        type="button"
        className={rowClasses}
        onClick={() => {
          setChangingPin(true);
        }}
      >
        <IconPin className="size-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{t("member.changePin.action")}</span>
      </button>
      <button
        type="button"
        className={rowClasses}
        onClick={() => {
          onAction();
          void signOut(queryClient);
        }}
      >
        <IconSignOut className="size-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{t("member.signOut")}</span>
      </button>
      <ChangePinDialog open={changingPin} onOpenChange={setChangingPin} />
    </section>
  );
}
