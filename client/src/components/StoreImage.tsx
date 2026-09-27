import { useState } from "react";
import { fallbackPhoto, photoSrc } from "@/lib/photos";

function StoreImageInner({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [current, setCurrent] = useState(() => photoSrc(src));
  const [failed, setFailed] = useState(false);

  return (
    <img
      className={className}
      src={current}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (failed) return;
        setFailed(true);
        setCurrent(fallbackPhoto(src || alt));
      }}
    />
  );
}

export function StoreImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  return <StoreImageInner key={src ?? "empty"} src={src} alt={alt} className={className} />;
}
