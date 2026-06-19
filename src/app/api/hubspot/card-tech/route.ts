import { NextRequest, NextResponse } from "next/server";

type WebRevealResults = Record<string, Array<{ name?: string }>>;

const normalizeDomain = (value: unknown): string => {
  return String(value || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .trim()
    .toLowerCase();
};

const getFirstName = (
  results: WebRevealResults | undefined,
  categoryName: string,
): string => {
  const items = Array.isArray(results?.[categoryName])
    ? results[categoryName]
    : [];

  return items[0]?.name || "no value";
};

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const cleanDomain = normalizeDomain(payload?.domain);

    if (!cleanDomain) {
      return NextResponse.json(
        {
          ok: false,
          message: "Dominio non valido.",
        },
        { status: 400 },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let response: Response;

    try {
      response = await fetch("https://webreveal.io/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://${cleanDomain}`,
        }),
        signal: controller.signal,
      });
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message: "WebReveal non ha risposto in tempo o non è raggiungibile.",
        },
        { status: 504 },
      );
    } finally {
      clearTimeout(timeout);
    }

    let data: {
      success?: boolean;
      results?: WebRevealResults;
      message?: string;
    } | null = null;

    try {
      data = await response.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message: "WebReveal ha restituito una risposta non valida.",
        },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            data?.message ||
            `WebReveal ha restituito un errore HTTP ${response.status}.`,
        },
        { status: response.status },
      );
    }

    if (data?.success !== true) {
      return NextResponse.json({
        ok: false,
        message: "Scan WebReveal non riuscita.",
      });
    }

    return NextResponse.json({
      ok: true,
      domain: cleanDomain,
      cms: getFirstName(data.results, "CMS"),
      accessibility: getFirstName(data.results, "Accessibility"),
      marketing: getFirstName(data.results, "Marketing"),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Errore interno del proxy Vercel.",
      },
      { status: 500 },
    );
  }
}
