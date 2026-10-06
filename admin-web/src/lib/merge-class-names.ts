import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names; later Tailwind classes win over earlier conflicting ones. */
export function mergeClassNames(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
