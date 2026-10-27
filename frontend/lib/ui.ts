// Tailwind class names shared by several components
export const cardClass = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100";

export const labelClass = "block text-sm font-medium text-gray-700";

export const inputBase =
  "block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-[15px] text-gray-900 placeholder-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";
export const inputClass = "mt-1.5 " + inputBase;

export const btnClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

export const smallBtnClass = secondaryBtnClass;