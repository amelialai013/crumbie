const pickupDateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Australia/Melbourne",
});

export function formatPickupDate(date: string) {
  const parts = pickupDateFormatter.formatToParts(new Date(`${date}T12:00:00+10:00`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")}`;
}
