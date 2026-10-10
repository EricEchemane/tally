import type { MetadataRoute } from "next";
import { DEMO_POSTER, DEMO_VIDEO_URL, SITE_URL } from "@/lib/links";

// One page; the old section URLs redirect into it (next.config.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
      images: [`${SITE_URL}${DEMO_POSTER}`],
      videos: [
        {
          title: "Tally demo: checking a liquidation's receipts offline",
          description: "Scan receipts with your phone, see which ones need a second look, and ask Tally about your liquidations.",
          thumbnail_loc: `${SITE_URL}${DEMO_POSTER}`,
          content_loc: DEMO_VIDEO_URL,
          duration: 83,
        },
      ],
    },
  ];
}
