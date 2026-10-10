import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview on social apps and chat: the logo, the promise and the platform, in the site's night and lime.
export const alt = "Tally: every receipt checked against BIR rules, offline on your Mac";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0f2b26",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoSrc} width={72} height={72} alt="" style={{ borderRadius: 18 }} />
          <span style={{ fontSize: 48, fontWeight: 700 }}>Tally</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Every receipt checked against BIR rules.
          </span>
          <span style={{ fontSize: 34, color: "#c5f06a" }}>Private, offline AI for liquidation reports, on your Mac.</span>
        </div>
      </div>
    ),
    size,
  );
}
