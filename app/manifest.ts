import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Amerikaner",
    short_name: "Amerikaner",
    description: "Poeng og statistikk for kortspillet amerikaner",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
  };
}
