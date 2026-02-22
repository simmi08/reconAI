import type { PropsWithChildren } from "react";

type BadgeProps = PropsWithChildren<{
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}>;

const toneClassMap: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-blue-100 text-blue-700"
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${toneClassMap[tone]}`}>
      {children}
    </span>
  );
}
