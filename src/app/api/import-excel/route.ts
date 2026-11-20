import { NextResponse } from "next/server";
import { parseLolonmebolWorkbookBuffer } from "@/lib/excel";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_EXCEL_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    // Enforce server-side Admin authorization when Supabase is configured
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        return NextResponse.json(
          { error: "Configuración de autenticación no disponible." },
          { status: 500 }
        );
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "No autenticado. Iniciá sesión como Admin." },
          { status: 401 }
        );
      }

      const { data: player, error: roleError } = await supabase
        .from("players")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleError || player?.role !== "admin") {
        return NextResponse.json(
          { error: "Acceso denegado. Solo un Admin puede importar Excel." },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file");

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
    const dataset = await parseLolonmebolWorkbookBuffer(arrayBuffer);

    return NextResponse.json({ dataset });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al procesar el archivo Excel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
