import { CalendarInteractiveView } from "@/components/calendar/CalendarInteractiveView";
import { getCalendarViewModel } from "@/server/queries";

interface CalendarioPageProps {
  searchParams: Promise<{ season?: string }>;
}

function parseCalendarSeasonParam(
  raw: string | undefined
): number | "all" | undefined {
  if (!raw) return undefined;
  if (raw.toLowerCase() === "all") return "all";
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : undefined;
}

export default async function CalendarioPage({
  searchParams,
}: CalendarioPageProps) {
  const params = await searchParams;
  const seasonFilter = parseCalendarSeasonParam(params.season);
  const viewModel = await getCalendarViewModel(seasonFilter);

  return (
    <CalendarInteractiveView
      key={viewModel.selectedSeasonId}
      seasons={viewModel.seasons}
      selectedSeasonId={viewModel.selectedSeasonId}
      events={viewModel.events}
      groupedByMonth={viewModel.groupedByMonth}
      initialMonth={viewModel.initialMonth}
    />
  );
}
