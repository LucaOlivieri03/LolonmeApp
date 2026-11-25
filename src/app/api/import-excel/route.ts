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
    const mode = modeRaw === "apply" ? "apply" : "preview";
    const overwriteRaw = formData.get("overwriteExisting");
    const overwriteExisting = overwriteRaw !== "false";

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
    const message =
      err instanceof Error ? err.message : "Error al procesar el archivo Excel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
