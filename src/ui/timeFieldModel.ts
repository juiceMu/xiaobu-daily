export interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function isValidTime(value: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

export function formatTime(hour: number, minute: number): string {
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}
