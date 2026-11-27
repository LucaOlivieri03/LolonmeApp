import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLolonmebolWorkbookBuffer } from "@/lib/excel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  applyExcelImportFromDataset,
  composeFullDataset,
  previewExcelImportFromDataset,
} from "@/server/admin/excel-import";
import { assertAdmin, getViewerSession, isAuthError } from "@/server/auth";
import { createSupabaseSeedClient } from "@/server/db";
import { CACHE_TAGS } from "@/server/queries/tags";
import {
  getAdminFundRepository,
  getPublicTournamentRepository,
} from "@/server/repositories";

const MAX_EXCEL_BYTES = 10 * 1024 * 1024; // 10 MB
const XLSX_ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

function hasZipMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < XLSX_ZIP_MAGIC.length) return false;
  const header = new Uint8Array(buffer, 0, XLSX_ZIP_MAGIC.length);
  return XLSX_ZIP_MAGIC.every((byte, idx) => header[idx] === byte);
}

function revalidateAllTournamentViews(): void {
  for (const tag of Object.values(CACHE_TAGS)) {
    revalidateTag(tag);
  }
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function POST(request: Request) {
  try {
    const session = await getViewerSession();
    try {
      assertAdmin(session);
    } catch (err) {
      if (isAuthError(err)) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const modeRaw = formData.get("mode");
    let mode: "preview" | "apply";
    if (modeRaw === null) {
      mode = "preview";
    } else if (modeRaw === "preview" || modeRaw === "apply") {
      mode = modeRaw;
    } else {
      return NextResponse.json(
        {
          error:
            "Parámetro mode inválido. Valores permitidos: preview | apply.",
        },
        { status: 400 }
      );
    }

    const overwriteRaw = formData.get("overwriteExisting");
    let overwriteExisting: boolean;
    if (overwriteRaw === null) {
      overwriteExisting = true;
    } else if (overwriteRaw === "true" || overwriteRaw === "false") {
      overwriteExisting = overwriteRaw === "true";
    } else {
      return NextResponse.json(
        {
          error:
            "Parámetro overwriteExisting inválido. Valores permitidos: true | false.",
        },
        { status: 400 }
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe adjuntar un archivo .xlsx válido." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "El archivo debe tener extensión .xlsx." },
        { status: 400 }
      );
    }

    if (file.size > MAX_EXCEL_BYTES) {
      return NextResponse.json(
        { error: "El archivo excede el límite máximo de 10 MB." },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!hasZipMagicBytes(arrayBuffer)) {
      return NextResponse.json(
        {
          error:
            "El archivo no tiene un formato .xlsx válido (firma ZIP inválida).",
        },
        { status: 400 }
      );
    }

    const [incomingDataset, publicData, fundData] = await Promise.all([
      parseLolonmebolWorkbookBuffer(arrayBuffer),
      getPublicTournamentRepository().getPublicDataset(),
      getAdminFundRepository().getFundData(),
    ]);

    const existingDataset = composeFullDataset(publicData, fundData);

    if (mode === "preview") {
      const previewResult = previewExcelImportFromDataset(
        session,
        existingDataset,
        incomingDataset
      );
      if (!previewResult.ok) {
        return NextResponse.json(
          { error: previewResult.error },
          { status: 403 }
        );
      }
      return NextResponse.json({
        mode: "preview",
        preview: previewResult.data,
      });
    }

    const supabase = await createSupabaseServerClient();
    const seedClient = supabase
      ? createSupabaseSeedClient(supabase as unknown as SupabaseClient)
      : null;

    const applyResult = await applyExcelImportFromDataset(
      session,
      existingDataset,
      incomingDataset,
      seedClient,
      { overwriteExisting }
    );

    if (!applyResult.ok) {
      const status = applyResult.code === "UNCONFIGURED" ? 503 : 500;
      return NextResponse.json({ error: applyResult.error }, { status });
    }

    revalidateAllTournamentViews();

    return NextResponse.json({
      mode: "apply",
      summary: applyResult.data,
      message: applyResult.message,
    });
  } catch (err) {
    console.error("[import-excel] Error processing uploaded workbook:", err);
    return NextResponse.json(
      {
        error:
          "No se pudo procesar el archivo Excel. Verificá que sea un .xlsx válido e intentá nuevamente.",
      },
      { status: 500 }
    );
  }
}
