import { NextRequest, NextResponse } from "next/server";

type AgentToolPayload = {
  inputFields?: {
    domain?: string;
  };
  fields?: {
    domain?: string;
  };
};

type WebRevealResults = Record<string, Array<{ name?: string }>>;

type WebRevealResponse = {
  success?: boolean;
  results?: WebRevealResults;
  message?: string;
};

const normalizeDomain = (value: unknown): string => {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(
      rawValue.startsWith("http://") || rawValue.startsWith("https://")
        ? rawValue
        : `https://${rawValue}`,
    );

    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const getFirstName = (
  results: WebRevealResults | undefined,
  categoryName: string,
): string => {
  const items = Array.isArray(results?.[categoryName])
    ? results[categoryName]
    : [];

  return items[0]?.name?.trim() || "no value";
};

const createOutput = (
  cms: string,
  accessibility: string,
  marketing: string,
) => {
  return {
    outputFields: {
      cms,
      accessibility,
      marketing,
    },
  };
};

export async function POST(req: NextRequest) {
  let payload: AgentToolPayload;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      createOutput(
        "Unable to analyze: invalid request.",
        "no value",
        "no value",
      ),
      { status: 400 },
    );
  }

  /*
   * La documentazione HubSpot mostra sia `inputFields`
   * sia `fields`. Usiamo entrambi per rendere l'endpoint
   * compatibile con il payload ricevuto.
   */
  const domain = payload.inputFields?.domain ?? payload.fields?.domain;

  const cleanDomain = normalizeDomain(domain);

  if (!cleanDomain) {
    return NextResponse.json(
      createOutput(
        "Unable to analyze: missing or invalid domain.",
        "no value",
        "no value",
      ),
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch("https://webreveal.io/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://${cleanDomain}`,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    let data: WebRevealResponse | null = null;

    try {
      data = await response.json();
    } catch {
      return NextResponse.json(
        createOutput(
          "Unable to analyze: WebReveal returned an invalid response.",
          "no value",
          "no value",
        ),
        { status: 502 },
      );
    }

    if (!response.ok || data?.success !== true) {
      const errorMessage =
        data?.message ||
        `WebReveal request failed with HTTP ${response.status}.`;

      return NextResponse.json(
        createOutput(
          `Unable to analyze: ${errorMessage}`,
          "no value",
          "no value",
        ),
        { status: 502 },
      );
    }

    return NextResponse.json(
      createOutput(
        getFirstName(data.results, "CMS"),
        getFirstName(data.results, "Accessibility"),
        getFirstName(data.results, "Marketing"),
      ),
    );
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";

    return NextResponse.json(
      createOutput(
        isTimeout
          ? "Unable to analyze: WebReveal response timed out."
          : "Unable to analyze: WebReveal is not reachable.",
        "no value",
        "no value",
      ),
      { status: isTimeout ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
