import { NextRequest, NextResponse } from "next/server";

type HubSpotWorkflowPayload = {
  object?: {
    properties?: {
      domain?: string;
    };
  };
};

type WebRevealResults = Record<string, Array<{ name?: string }>>;

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
  let payload: HubSpotWorkflowPayload;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      {
        outputFields: {
          cms: "no value",
          accessibility: "no value",
          marketing: "no value",
        },
      },
      { status: 400 },
    );
  }

  const domain = payload.object?.properties?.domain;

  if (!domain) {
    return NextResponse.json({
      outputFields: {
        cms: "no value",
        accessibility: "no value",
        marketing: "no value",
      },
    });
  }

  const cleanDomain = String(domain)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();

  if (!cleanDomain) {
    return NextResponse.json({
      outputFields: {
        cms: "no value",
        accessibility: "no value",
        marketing: "no value",
      },
    });
  }

  try {
    const response = await fetch("https://webreveal.io/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://${cleanDomain}`,
      }),
    });

    let data: {
      success?: boolean;
      results?: WebRevealResults;
    } | null = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || data?.success !== true) {
      return NextResponse.json({
        outputFields: {
          cms: "no value",
          accessibility: "no value",
          marketing: "no value",
        },
      });
    }

    return NextResponse.json({
      outputFields: {
        cms: getFirstName(data.results, "CMS"),
        accessibility: getFirstName(data.results, "Accessibility"),
        marketing: getFirstName(data.results, "Marketing"),
      },
    });
  } catch {
    return NextResponse.json({
      outputFields: {
        cms: "no value",
        accessibility: "no value",
        marketing: "no value",
      },
    });
  }
}
