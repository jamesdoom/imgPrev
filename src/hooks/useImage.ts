// src/hooks/useImage.ts

import { useState, useEffect } from "react";

export function useImage(src: string): [HTMLImageElement | null, boolean] {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      setImage(img);
      setLoaded(true);
    };
    img.onerror = () => {
      setImage(null);
      setLoaded(false);
    };
  }, [src]);

  return [image, loaded];
}
