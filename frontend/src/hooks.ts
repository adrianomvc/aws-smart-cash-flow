import { useMemo, Dispatch, SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ApiSession, PeriodState, TransactionPeriodPreset } from "./types";
import { getCategories } from "./lib/api";

// ---------------------------------------------------------------------------
// Helper functions used by usePeriod
// (duplicated here until src/lib/utils.ts is extracted)
// ---------------------------------------------------------------------------

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function isSingleMonthRange(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  return Boolean(
    start &&
      end &&
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth(),
  );
}

function yearQueryFromDate(value: string) {
  const [year] = value.split("-");
  if (!year) return "";
  const params = new URLSearchParams();
  params.set("date_from", `${year}-01-01`);
  params.set("date_to", `${year}-12-31`);
  return `?${params.toString()}`;
}

function rangeMonthCount(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  if (!start || !end) return Number.POSITIVE_INFINITY;
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth() +
    1
  );
}

function trailingMonthsQuery(dateTo: string, monthCount: number) {
  const end = parseIsoDate(dateTo);
  if (!end) return "";
  const start = new Date(end.getFullYear(), end.getMonth() - monthCount + 1, 1);
  const params = new URLSearchParams();
  params.set("date_from", isoDate(start));
  params.set("date_to", isoDate(end));
  return `?${params.toString()}`;
}

function periodRange(preset: TransactionPeriodPreset) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  if (preset === "all" || preset === "custom") {
    return { dateFrom: "", dateTo: "" };
  }
  if (preset === "current_year") {
    return {
      dateFrom: isoDate(new Date(currentYear, 0, 1)),
      dateTo: isoDate(new Date(currentYear, 11, 31)),
    };
  }
  if (preset === "previous_year") {
    return {
      dateFrom: isoDate(new Date(currentYear - 1, 0, 1)),
      dateTo: isoDate(new Date(currentYear - 1, 11, 31)),
    };
  }
  if (preset === "previous_month") {
    return {
      dateFrom: isoDate(new Date(currentYear, currentMonth - 1, 1)),
      dateTo: isoDate(new Date(currentYear, currentMonth, 0)),
    };
  }
  // current_month (default)
  return {
    dateFrom: isoDate(new Date(currentYear, currentMonth, 1)),
    dateTo: isoDate(now),
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePeriod(
  periodState: PeriodState,
  setPeriodState: Dispatch<SetStateAction<PeriodState>>,
) {
  const { dateFrom, dateTo, periodPreset } = periodState;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [dateFrom, dateTo]);

  const trendQuery = useMemo(() => {
    if (
      periodPreset === "current_month" ||
      periodPreset === "previous_month" ||
      isSingleMonthRange(dateFrom, dateTo)
    ) {
      return yearQueryFromDate(dateFrom || dateTo);
    }
    return query;
  }, [dateFrom, dateTo, periodPreset, query]);

  const recurringQuery = useMemo(() => {
    if (dateTo && rangeMonthCount(dateFrom || dateTo, dateTo) < 12) {
      return trailingMonthsQuery(dateTo, 12);
    }
    return query;
  }, [dateFrom, dateTo, query]);

  function setPeriodPreset(nextPreset: TransactionPeriodPreset) {
    const range = periodRange(nextPreset);
    setPeriodState({ ...range, periodPreset: nextPreset });
  }

  function setDateFrom(nextDateFrom: string) {
    setPeriodState((current) => ({
      ...current,
      dateFrom: nextDateFrom,
      periodPreset: "custom",
    }));
  }

  function setDateTo(nextDateTo: string) {
    setPeriodState((current) => ({
      ...current,
      dateTo: nextDateTo,
      periodPreset: "custom",
    }));
  }

  return {
    dateFrom,
    dateTo,
    periodPreset,
    query,
    recurringQuery,
    setDateFrom,
    setDateTo,
    setPeriodPreset,
    trendQuery,
  };
}

export function useCategories(session: ApiSession) {
  return useQuery({
    queryKey: ["categories", session.token],
    queryFn: () => getCategories(session),
  });
}
