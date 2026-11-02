// Tailwind class names shared by many components
export const cardClass = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

export const labelClass = "block text-sm font-medium text-slate-700";

export const inputBase =
  "block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/10 disabled:bg-slate-50 disabled:text-slate-400";
export const inputClass = "mt-1.5 " + inputBase;

export const btnClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50";

export const smallBtnClass = secondaryBtnClass;