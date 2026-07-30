import coverImg from "@/assets/coup-cover.png";

export type CoverArtVariant = "card" | "hero" | "splash";

export interface CoverArtProps {
  className?: string;
  variant?: CoverArtVariant;
}

export default function CoverArt({ className = "", variant = "card" }: CoverArtProps) {
  const classes = ["cover-art", `cover-art--${variant}`, className].filter(Boolean).join(" ");

  return (
    <img
      src={coverImg}
      alt="Coup — arte de capa"
      className={classes}
      width={720}
      height={1080}
      decoding="async"
    />
  );
}

export { coverImg };
