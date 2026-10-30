import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  MousePointer2,
  PanelsTopLeft,
  SlidersHorizontal,
  Type,
} from "lucide-react";
import { t } from "@/messages/en";
import {
  Alert,
  Button,
  Input,
  RadioGroup,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import {
  CompetenceCard,
  ChoiceRow,
  Field,
  Notice,
  StatusLine,
  TimeSlotChip,
} from "@/components/skillswap";

const iconClass = "kit-section-icon";

export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="kit-shell">
      <header className="kit-topbar">
        <div className="kit-brand">{t("brand")}</div>
      </header>
      <div className="kit-content">
        <header className="kit-overview">
          <h1 className="kit-title">{t("kitTitle")}</h1>
          <p className="kit-intro">{t("kitIntro")}</p>
        </header>

        <div className="kit-grid">
          <div className="kit-column">
            <ButtonsSection />
            <ChoicesSection />
            <TimeSection />
            <StatusSection />
          </div>
          <div className="kit-column">
            <FieldsSection />
            <FeedbackSection />
            <CompetenceSection />
            <StickySection />
          </div>
        </div>
      </div>
    </main>
  );
}

function ButtonsSection() {
  return (
    <section className="kit-section" aria-labelledby="kit-buttons">
      <h2 id="kit-buttons">
        <MousePointer2 className={iconClass} aria-hidden="true" />
        {t("kitButtons")}
      </h2>
      <div className="kit-row">
        <div>
          <p className="kit-example-label">{t("kitStateDefault")}</p>
          <Button>{t("kitDefaultButton")}</Button>
        </div>
        <div>
          <p className="kit-example-label">{t("kitStateDefault")}</p>
          <Button variant="secondary">{t("kitSecondaryButton")}</Button>
        </div>
        <div>
          <p className="kit-example-label">{t("kitStateDefault")}</p>
          <Button variant="text">{t("kitTextButton")}</Button>
        </div>
        <div>
          <p className="kit-example-label">{t("kitStateDisabled")}</p>
          <Button disabled>{t("kitDisabledButton")}</Button>
        </div>
      </div>
    </section>
  );
}

function FieldsSection() {
  return (
    <section className="kit-section kit-stack" aria-labelledby="kit-fields">
      <h2 id="kit-fields">
        <Type className={iconClass} aria-hidden="true" />
        {t("kitInputs")}
      </h2>
      <p className="kit-example-label">{t("kitStateDefault")}</p>
      <Field
        id="task-default"
        label={t("kitFieldLabel")}
        hint={t("kitFieldHint")}
      >
        <Input
          id="task-default"
          aria-describedby="task-default-hint"
          placeholder={t("kitFieldPlaceholder")}
        />
      </Field>
      <p className="kit-example-label">{t("kitStateError")}</p>
      <Field
        id="task-error"
        label={t("kitFieldLabel")}
        hint={t("kitFieldHint")}
        error={t("kitFieldError")}
      >
        <Textarea
          id="task-error"
          aria-describedby="task-error-hint task-error-error"
          aria-invalid="true"
          defaultValue={t("kitFieldValue")}
        />
      </Field>
      <p className="kit-example-label">{t("kitStateDefault")}</p>
      <Field id="task-area" label={t("kitSelectLabel")}>
        <Select
          id="task-area"
          defaultValue="stem"
          placeholder={t("kitSelectPlaceholder")}
          options={[
            { value: "stem", label: t("kitSelectStem") },
            { value: "creative", label: t("kitSelectCreative") },
            { value: "other", label: t("kitSelectOther") },
          ]}
        />
      </Field>
    </section>
  );
}

function ChoicesSection() {
  return (
    <section className="kit-section kit-stack" aria-labelledby="kit-choices">
      <h2 id="kit-choices">
        <SlidersHorizontal className={iconClass} aria-hidden="true" />
        {t("kitChoices")}
      </h2>
      <p className="kit-example-label">{t("kitStateSelected")}</p>
      <RadioGroup name="primitive-choice" defaultValue="stem">
        <ChoiceRow
          id="choice-stem"
          type="radio"
          value="stem"
          title={t("kitChoiceRadio")}
          description={t("kitChoiceRadioDescription")}
          selected
        />
        <ChoiceRow
          id="choice-creative"
          type="radio"
          value="creative"
          title={t("kitSelectCreative")}
          description={t("kitChoiceRadioDescription")}
        />
      </RadioGroup>
      <ChoiceRow
        id="choice-consent"
        type="checkbox"
        title={t("kitChoiceCheckbox")}
        description={t("kitChoiceCheckboxDescription")}
      />
      <ChoiceRow
        id="choice-checked"
        type="checkbox"
        title={t("kitChoiceCheckbox")}
        description={t("kitChoiceCheckboxDescription")}
        selected
      />
      <ChoiceRow
        id="choice-disabled"
        type="checkbox"
        title={t("kitChoiceRadio")}
        description={t("kitChoiceRadioDescription")}
        disabled
      />
    </section>
  );
}

function FeedbackSection() {
  return (
    <section className="kit-section kit-stack" aria-labelledby="kit-feedback">
      <h2 id="kit-feedback">
        <CircleHelp className={iconClass} aria-hidden="true" />
        {t("kitNotice")}
      </h2>
      <div className="kit-feedback-grid">
        <Alert title={t("kitNotice")}>{t("kitNoticeText")}</Alert>
        <Notice tone="warning" title={t("kitNoticeWarning")}>
          {t("kitNoticeText")}
        </Notice>
        <Notice tone="error" title={t("kitErrorNotice")}>
          {t("kitErrorNoticeText")}
        </Notice>
        <Notice tone="success" title={t("kitSuccessNotice")}>
          {t("kitSuccessNoticeText")}
        </Notice>
        <Notice tone="info" title={t("kitNoShowTitle")}>
          {t("kitNoShowText")}
        </Notice>
        <Notice tone="info" title={t("kitContactTitle")}>
          {t("kitContactText")}
        </Notice>
      </div>
    </section>
  );
}

function TimeSection() {
  return (
    <section className="kit-section kit-stack" aria-labelledby="kit-time">
      <h2 id="kit-time">
        <CalendarClock className={iconClass} aria-hidden="true" />
        {t("kitTimeSlot")}
      </h2>
      <div className="kit-row">
        <TimeSlotChip />
        <TimeSlotChip selected />
        <TimeSlotChip disabled />
      </div>
    </section>
  );
}

function CompetenceSection() {
  return (
    <section className="kit-section kit-stack" aria-labelledby="kit-competence">
      <h2 id="kit-competence">
        <BadgeCheck className={iconClass} aria-hidden="true" />
        {t("kitCompetenceTitle")}
      </h2>
      <CompetenceCard />
    </section>
  );
}

function StatusSection() {
  return (
    <section className="kit-section kit-stack" aria-labelledby="kit-status">
      <h2 id="kit-status">
        <PanelsTopLeft className={iconClass} aria-hidden="true" />
        {t("kitStatusActive")}
      </h2>
      <div className="kit-row kit-status-row">
        <StatusLine>{t("kitStatusActive")}</StatusLine>
        <StatusLine state="active">
          <CircleCheck className="kit-state-icon" aria-hidden="true" />
          {t("kitStatusActive")}
        </StatusLine>
        <StatusLine state="warning">
          <CircleAlert className="kit-state-icon" aria-hidden="true" />
          {t("kitStatusWarning")}
        </StatusLine>
      </div>
    </section>
  );
}

function StickySection() {
  return (
    <section className="kit-section" aria-labelledby="kit-sticky">
      <h2 id="kit-sticky">
        <MousePointer2 className={iconClass} aria-hidden="true" />
        {t("kitStickyHeading")}
      </h2>
      <p className="kit-intro">{t("kitStickyNote")}</p>
      <div className="kit-sticky-preview">
        <span>{t("kitStickyNote")}</span>
        <Button className="kit-wide-button">{t("kitStickyAction")}</Button>
      </div>
    </section>
  );
}
