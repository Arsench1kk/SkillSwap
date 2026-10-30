"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "text" };
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={cn(`ui-button ui-button-${variant}`, className)} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("ui-input", props.className)} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("ui-textarea", props.className)} {...props} />;
}

export function Label(props: LabelPrimitive.LabelProps) {
  return <LabelPrimitive.Root className={cn("control-label", props.className)} {...props} />;
}

export function RadioGroup({ children, ...props }: RadioGroupPrimitive.RadioGroupProps) {
  return <RadioGroupPrimitive.Root className="ui-choice-group" {...props}>{children}</RadioGroupPrimitive.Root>;
}

export function Choice({ id, title, description, type = "checkbox", value, disabled, defaultChecked }: { id: string; type?: "checkbox" | "radio"; title: string; description?: string; value?: string; disabled?: boolean; defaultChecked?: boolean }) {
  const controlRef = useRef<HTMLButtonElement>(null);
  const activateFromRow = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest("button, label")) controlRef.current?.click();
  };
  if (type === "radio") {
    return <div className="ui-choice" onClick={activateFromRow}>
      <RadioGroupPrimitive.Item ref={controlRef} id={id} className="ui-choice-control ui-radio-control" value={value ?? title} disabled={disabled}>
        <RadioGroupPrimitive.Indicator className="ui-choice-indicator" />
      </RadioGroupPrimitive.Item>
      <Label htmlFor={id} className="ui-choice-copy"><span className="ui-choice-title">{title}</span>{description ? <span className="ui-choice-description">{description}</span> : null}</Label>
    </div>;
  }

  return <div className="ui-choice" onClick={activateFromRow}>
    <CheckboxPrimitive.Root ref={controlRef} id={id} className="ui-choice-control ui-checkbox-control" defaultChecked={defaultChecked} disabled={disabled}>
      <CheckboxPrimitive.Indicator className="ui-choice-indicator"><Check size={16} aria-hidden="true" /></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
    <Label htmlFor={id} className="ui-choice-copy"><span className="ui-choice-title">{title}</span>{description ? <span className="ui-choice-description">{description}</span> : null}</Label>
  </div>;
}

export function Select({ id, defaultValue = "", placeholder, options = [], disabled, "aria-describedby": describedBy, "aria-invalid": invalid }: { id?: string; defaultValue?: string; placeholder: string; options: { value: string; label: string }[]; disabled?: boolean; "aria-describedby"?: string; "aria-invalid"?: boolean }) {
  return <SelectPrimitive.Root defaultValue={defaultValue} disabled={disabled}>
    <SelectPrimitive.Trigger id={id} aria-describedby={describedBy} aria-invalid={invalid} className="ui-select">
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon><ChevronDown size={18} aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="ui-select-content" position="popper" sideOffset={4}>
        <SelectPrimitive.Viewport>
          {options.map((option) => <SelectPrimitive.Item className="ui-select-item" key={option.value} value={option.value}>
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator><Check size={16} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "error" | "success"; title: string; children: React.ReactNode }) {
  const role = tone === "error" ? "alert" : "status";
  const Icon = tone === "warning" ? TriangleAlert : tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info;
  return <section className="ui-alert" data-tone={tone === "info" ? undefined : tone} role={role}>
    <Icon className="ui-alert-icon" size={20} aria-hidden="true" />
    <div><h3 className="ui-alert-title">{title}</h3><p>{children}</p></div>
  </section>;
}
