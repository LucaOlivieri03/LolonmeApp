export interface NormalizedPlayerName {
  canonicalName: string;
  starsCount: number;
  isCaptain: boolean;
  note: string | null;
}

export interface ParsedCupCaptainCell {
  canonicalName: string;
  score: number | null;
  aggregate: number | null;
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export function normalizePlayerName(raw: string): NormalizedPlayerName {
  const starMatches = raw.match(/⭐|★/g);
  const starsCount = starMatches ? starMatches.length : 0;

  // Remove star emojis and variation selectors
  let cleaned = raw.replace(/[⭐★\uFE0F]/g, "").trim();

  let isCaptain = false;
  let note: string | null = null;

  const parenMatch = cleaned.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = parenMatch[1].trim().toLowerCase();
    if (inside === "c" || inside === "cap" || inside === "capitán") {
      isCaptain = true;
    } else {
      note = parenMatch[1].trim();
    }
    cleaned = cleaned.replace(/\([^)]*\)/g, "").trim();
  }

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return {
    canonicalName: cleaned,
    starsCount,
    isCaptain,
    note,
  };
}

export function playerSlug(canonicalName: string): string {
  return canonicalName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseCupCaptainCell(raw: string): ParsedCupCaptainCell {
  const withoutStars = raw.replace(/[⭐★\uFE0F]/g, "").replace(/\s+/g, " ").trim();
  // Format examples: "Pipo 5 (5)", "B. Aguzzi 9 (9)", "Joaco 14 (14)", "Lolo 6 (7)"
  const match = withoutStars.match(/^(.+?)\s+(\d+)\s*(?:\((\d+)\))?$/);
  if (match) {
    const normalized = normalizePlayerName(match[1]);
    return {
      canonicalName: normalized.canonicalName,
      score: Number(match[2]),
      aggregate: match[3] ? Number(match[3]) : null,
    };
  }
  const normalized = normalizePlayerName(withoutStars);
  return {
    canonicalName: normalized.canonicalName,
    score: null,
    aggregate: null,
  };
}

export function parseSpanishDate(raw: unknown, fallbackYear: number): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  const text = String(raw ?? "").trim();
  if (!text) return `${fallbackYear}-01-01`;

  // ISO YYYY-MM-DD
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Spanish "4 de febrero" or "24 de febrero de 2026"
  const esMatch = text
    .toLowerCase()
    .match(/(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?/i);
  if (esMatch) {
    const day = Number(esMatch[1]);
    const month = SPANISH_MONTHS[esMatch[2].toLowerCase()];
    const year = esMatch[3] ? Number(esMatch[3]) : fallbackYear;
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // JS Date string (e.g. "Tue Jul 28 2026 21:00:00 GMT-0300 ...")
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return `${fallbackYear}-01-01`;
}
