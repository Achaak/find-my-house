import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { PropertyPhoto } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

const SWIPE_THRESHOLD_PX = 48;

type PropertyPhotoCarouselProps = {
  photos: PropertyPhoto[];
  alt: string;
  className?: string;
  imageClassName?: string;
  overlayFriendly?: boolean;
  onImageError?: () => void;
};

function usePhotoCarousel(photos: PropertyPhoto[]) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  const visiblePhotos = photos.filter((_, photoIndex) => !failed[photoIndex]);
  const safeIndex = Math.min(index, Math.max(visiblePhotos.length - 1, 0));
  const total = visiblePhotos.length;

  const goTo = useCallback(
    (nextIndex: number) => {
      if (total <= 1) return;
      setIndex((nextIndex + total) % total);
    },
    [total]
  );

  const onTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    didSwipe.current = false;
  };

  const onTouchEnd = (event: TouchEvent) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (startX === null || endX === undefined) return;

    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    didSwipe.current = true;
    goTo(delta < 0 ? safeIndex + 1 : safeIndex - 1);
  };

  const markFailed = (photoIndex: number) => {
    setFailed((prev) => ({ ...prev, [photoIndex]: true }));
  };

  const resetSwipeFlag = () => {
    didSwipe.current = false;
  };

  return {
    visiblePhotos,
    safeIndex,
    total,
    current: visiblePhotos[safeIndex],
    goTo,
    onTouchStart,
    onTouchEnd,
    didSwipe,
    markFailed,
    resetSwipeFlag,
  };
}

function PhotoControls({
  safeIndex,
  total,
  overlayFriendly,
  onPrev,
  onNext,
  className,
}: {
  safeIndex: number;
  total: number;
  overlayFriendly?: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  if (total <= 1) return null;

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 px-3",
          overlayFriendly
            ? "top-3"
            : "bottom-0 bg-gradient-to-t from-black/50 to-transparent pb-3 pt-8",
          className
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-white",
            overlayFriendly ? "justify-end" : "justify-between"
          )}
        >
          <span className="rounded-full bg-black/45 px-2 py-0.5 tabular-nums">
            {m.property_photo_counter({
              current: safeIndex + 1,
              total,
            })}
          </span>
          {!overlayFriendly ? (
            <div className="flex max-w-[60%] flex-wrap justify-end gap-1">
              {Array.from({ length: total }, (_, dotIndex) => (
                <span
                  key={dotIndex}
                  className={cn(
                    "size-1.5 rounded-full bg-white/40",
                    dotIndex === safeIndex && "bg-white"
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        aria-label={m.property_photo_prev()}
        className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/60 md:inline-flex"
        onClick={onPrev}
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label={m.property_photo_next()}
        className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/60 md:inline-flex"
        onClick={onNext}
      >
        <ChevronRight className="size-5" />
      </button>
    </>
  );
}

function PropertyPhotoFullscreen({
  open,
  onClose,
  photos,
  alt,
  safeIndex,
  total,
  onPrev,
  onNext,
  onTouchStart,
  onTouchEnd,
}: {
  open: boolean;
  onClose: () => void;
  photos: PropertyPhoto[];
  alt: string;
  safeIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onTouchStart: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
}) {
  const current = photos[safeIndex];

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, onPrev, onNext]);

  if (!open || !current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={m.property_photo_fullscreen_label()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
        <span className="text-sm tabular-nums">
          {m.property_photo_counter({
            current: safeIndex + 1,
            total,
          })}
        </span>
        <button
          type="button"
          aria-label={m.property_photo_fullscreen_close()}
          className="rounded-full p-2 hover:bg-white/10"
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-4">
        <img
          src={current.url}
          alt={alt}
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />

        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label={m.property_photo_prev()}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              onClick={onPrev}
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label={m.property_photo_next()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              onClick={onNext}
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function PropertyPhotoCarousel({
  photos,
  alt,
  className,
  imageClassName,
  overlayFriendly = false,
  onImageError,
}: PropertyPhotoCarouselProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const {
    visiblePhotos,
    safeIndex,
    total,
    current,
    goTo,
    onTouchStart,
    onTouchEnd,
    didSwipe,
    markFailed,
    resetSwipeFlag,
  } = usePhotoCarousel(photos);

  const openFullscreen = () => {
    if (didSwipe.current) {
      resetSwipeFlag();
      return;
    }
    setFullscreenOpen(true);
  };

  const goPrev = () => goTo(safeIndex - 1);
  const goNext = () => goTo(safeIndex + 1);

  if (!current) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground",
          imageClassName
        )}
      >
        {m.property_no_photo()}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn("relative overflow-hidden bg-muted", className)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          className="block w-full cursor-zoom-in"
          aria-label={m.property_photo_fullscreen_open()}
          onClick={openFullscreen}
        >
          <img
            src={current.url}
            alt={alt}
            className={cn("aspect-[4/3] w-full object-cover", imageClassName)}
            draggable={false}
            onError={() => {
              markFailed(safeIndex);
              onImageError?.();
            }}
          />
        </button>

        <button
          type="button"
          aria-label={m.property_photo_fullscreen_open()}
          className="absolute right-2 top-2 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/60"
          onClick={() => setFullscreenOpen(true)}
        >
          <Maximize2 className="size-4" />
        </button>

        <PhotoControls
          safeIndex={safeIndex}
          total={total}
          overlayFriendly={overlayFriendly}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>

      <PropertyPhotoFullscreen
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        photos={visiblePhotos}
        alt={alt}
        safeIndex={safeIndex}
        total={total}
        onPrev={goPrev}
        onNext={goNext}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
    </>
  );
}
