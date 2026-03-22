import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CineCue",
    short_name: "CineCue",
    description: "Track the local theatrical life of the movies you care about.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5eee4",
    theme_color: "#2a1a14",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
