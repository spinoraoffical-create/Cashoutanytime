"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_COUNTRY_ISO,
  getCountryByIso,
} from "@/lib/auth/country-codes";
import { phoneFromParts as parsePhoneFromParts } from "@/lib/auth/phone";

export { DEFAULT_COUNTRY_ISO };

export function phoneFromParts(countryIso: string, localNumber: string): string | null {
  if (!getCountryByIso(countryIso)) return null;
  return parsePhoneFromParts(countryIso, localNumber);
}

interface PhoneNumberInputProps {
  id?: string;
  countryIso: string;
  onCountryIsoChange: (iso: string) => void;
  localNumber: string;
  onLocalNumberChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function PhoneNumberInput({
  id = "phone",
  countryIso,
  onCountryIsoChange,
  localNumber,
  onLocalNumberChange,
  required,
  disabled,
  className,
}: PhoneNumberInputProps) {
  const selected = getCountryByIso(countryIso);

  return (
    <div className={cn("flex gap-2", className)}>
      <Select value={countryIso} onValueChange={onCountryIsoChange} disabled={disabled}>
        <SelectTrigger className="w-[130px] shrink-0 font-mono text-xs sm:w-[150px] sm:text-sm">
          <SelectValue>
            {selected ? `${selected.flag} ${selected.dial}` : "Country"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {COUNTRY_DIAL_CODES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <span className="flex items-center gap-2">
                <span>{country.flag}</span>
                <span className="font-mono">{country.dial}</span>
                <span className="text-muted-foreground truncate">{country.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={localNumber}
        onChange={(e) => onLocalNumberChange(e.target.value.replace(/[^\d\s-]/g, ""))}
        required={required}
        disabled={disabled}
        placeholder="9862953426"
        className="font-mono flex-1"
      />
    </div>
  );
}
