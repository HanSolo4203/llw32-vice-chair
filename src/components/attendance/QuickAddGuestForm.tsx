"use client";

import { useState } from "react";
import { Loader2Icon, UserPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type QuickAddGuestFormValues = {
  full_name: string;
  email: string;
  phone: string;
};

type QuickAddGuestFormProps = {
  onSubmit: (values: QuickAddGuestFormValues) => Promise<void>;
  loading?: boolean;
};

const initialValues: QuickAddGuestFormValues = {
  full_name: "",
  email: "",
  phone: "",
};

function QuickAddGuestForm({ onSubmit, loading = false }: QuickAddGuestFormProps) {
  const [values, setValues] = useState<QuickAddGuestFormValues>(initialValues);
  const [internalLoading, setInternalLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.full_name.trim() || internalLoading || loading) return;

    setInternalLoading(true);
    try {
      await onSubmit({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
      });
      setValues(initialValues);
    } finally {
      setInternalLoading(false);
    }
  };

  const disabled = loading || internalLoading;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 grid gap-3 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase text-muted-foreground">
          Full Name
        </label>
        <Input
          value={values.full_name}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, full_name: event.target.value }))
          }
          placeholder="Guest full name"
          required
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase text-muted-foreground">
          Email
        </label>
        <Input
          value={values.email}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, email: event.target.value }))
          }
          type="email"
          placeholder="guest@example.com"
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase text-muted-foreground">
          Phone
        </label>
        <Input
          value={values.phone}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, phone: event.target.value }))
          }
          placeholder="+27 82 000 0000"
          disabled={disabled}
        />
      </div>
      <Button
        type="submit"
        className="w-full gap-2 self-end sm:w-auto"
        disabled={disabled}
      >
        {disabled ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <UserPlusIcon className="size-4" />
        )}
        Add Guest
      </Button>
    </form>
  );
}

export default QuickAddGuestForm;


