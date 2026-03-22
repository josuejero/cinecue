import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            "radial-gradient(circle at top, rgba(198,154,90,0.45), transparent 36%), linear-gradient(180deg, #3c241d 0%, #251712 100%)",
          color: "#fdf6ee",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 114,
            height: 114,
            borderRadius: 9999,
            border: "8px solid rgba(255,255,255,0.12)",
            boxShadow: "0 0 0 8px rgba(198,154,90,0.16)",
          }}
        />
        <div
          style={{
            fontSize: 82,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          C
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
