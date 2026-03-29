export function formatLapTime(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "--:--.---";

  const totalMs = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;

  const minutesText = minutes.toString();
  const secondsText = seconds.toString().padStart(2, "0");
  const msText = milliseconds.toString().padStart(3, "0");

  return `${minutesText}:${secondsText}.${msText}`;
}
