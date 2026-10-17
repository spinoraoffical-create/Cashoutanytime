"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordProblems } from "@/lib/auth/password-rules";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  showRules?: boolean;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  showRules = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const problems = showRules && value ? passwordProblems(value) : [];

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pr-16"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {showRules && (
        <ul className="space-y-1 text-xs text-zinc-500">
          <li className={value.length >= 8 ? "text-emerald-700" : undefined}>At least 8 characters</li>
          <li className={/[A-Za-z]/.test(value) ? "text-emerald-700" : undefined}>One letter</li>
          <li className={/\d/.test(value) ? "text-emerald-700" : undefined}>One number</li>
        </ul>
      )}
      {problems.length > 0 && <p className="sr-only">{problems.join(" ")}</p>}
    </div>
  );
}
