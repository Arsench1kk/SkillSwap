"use client";

import { useState } from "react";
import { t } from "@/messages/en";
import { Button, Choice, Label } from "@/components/ui/primitives";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return <div className="ui-field">
    <Label htmlFor={id}>{label}</Label>
    {hint ? <span className="control-hint" id={hintId}>{hint}</span> : null}
    {children}
    {error ? <span className="control-error" id={errorId}>{error}</span> : null}
  </div>;
}

export function ChoiceRow({ id, title, description, selected = false, type = "radio", value, disabled = false }: { id: string; title: string; description?: string; selected?: boolean; type?: "radio" | "checkbox"; value?: string; disabled?: boolean }) {
  return <Choice id={id} title={title} description={description} type={type} value={value} defaultChecked={type === "checkbox" ? selected : undefined} disabled={disabled} />;
}

export function TimeSlotChip({ selected = false, disabled = false }: { selected?: boolean; disabled?: boolean }) {
  const [pressed, setPressed] = useState(selected);
  return <button className="ss-time-chip" type="button" aria-pressed={pressed} disabled={disabled} onClick={() => setPressed(!pressed)}>
    <span className="ss-time-day">{t("kitTimeSlot")}</span><span className="ss-time-meta">{t("kitTime")}</span>
  </button>;
}

export function Notice({ tone, title, children }: { tone?: "info" | "warning" | "error" | "success"; title: string; children: React.ReactNode }) {
  const role = tone === "error" ? "alert" : "status";
  const Icon = tone === "warning" ? TriangleAlert : tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info;
  return <section className="ui-alert" data-tone={tone === "info" ? undefined : tone} role={role}>
    <Icon className="ui-alert-icon" size={20} aria-hidden="true" />
    <div><h3 className="ui-alert-title">{title}</h3><p>{children}</p></div>
  </section>;
}

export function CompetenceCard() {
  return <article className="ss-competence"><h3>{t("kitCompetenceTitle")}</h3><dl className="ss-facts">
    <div className="ss-fact"><dt>{t("kitFactStudy")}</dt><dd>{t("kitFactStudyValue")}</dd></div>
    <div className="ss-fact"><dt>{t("kitFactSkill")}</dt><dd>{t("kitFactSkillValue")}</dd></div>
    <div className="ss-fact"><dt>{t("kitFactProof")}</dt><dd>{t("kitFactProofValue")}</dd></div>
    <div className="ss-fact"><dt>{t("kitFactExperience")}</dt><dd>{t("kitFactExperienceValue")}</dd></div>
  </dl></article>;
}

export function StatusLine({ children, state = "plain" }: { children: React.ReactNode; state?: "plain" | "active" | "warning" }) {
  return <p className="ss-status" data-state={state}><span className="ss-status-marker" aria-hidden="true" />{children}</p>;
}

export function StickyActionBar() {
  return <div className="ss-sticky"><div className="ss-sticky-inner"><span className="control-hint">{t("kitStickyNote")}</span><Button className="kit-wide-button">{t("kitStickyAction")}</Button></div></div>;
}
