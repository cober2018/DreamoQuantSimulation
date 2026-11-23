// 来源：smoothui · scrubber · https://github.com/educlopez/smoothui（MIT，保留原作者版权）。经 ts.leess.fun 效果库选用；
// 本文件的改动：导入路径；数值固定为整数「第几天」，新增 valueText（给读屏软件读日期）和 onInteract（访客一碰就通知外层）；
// 去掉轨道内部的标签和数值文字（日期显示在轨道外面）；颜色改用官网变量。拖动、方向键、Home、End 的逻辑保持原样。
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ScrubberProps {
  className?: string;
  /** 读屏软件用的名称 */
  label?: string;
  max?: number;
  min?: number;
  onValueChange?: (value: number) => void;
  /** 指针按下或键盘操作时调用（用来停掉自动演示） */
  onInteract?: () => void;
  step?: number;
  /** 刻度数；0 不显示 */
  ticks?: number;
  value: number;
  /** aria-valuetext，例如「2026-11-17 星期二」 */
  valueText?: string;
}

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
const roundToStep = (val: number, step: number, min: number) => Math.round((val - min) / step) * step + min;

const Scrubber = ({
  label = "日期",
  value,
  onValueChange,
  onInteract,
  min = 0,
  max = 1,
  step = 1,
  ticks = 0,
  valueText,
  className,
}: ScrubberProps) => {
  const shouldReduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);

  const range = max - min;
  const percentage = range > 0 ? ((value - min) / range) * 100 : 0;
  const isActive = isDragging || (isHoverDevice && isHovering);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsHoverDevice(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsHoverDevice(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setValue = useCallback(
    (newValue: number) => {
      onValueChange?.(clamp(roundToStep(newValue, step, min), min, max));
    },
    [step, min, max, onValueChange]
  );

  const getValueFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return min + ratio * range;
    },
    [min, range, value]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      onInteract?.();
      trackRef.current?.setPointerCapture(e.pointerId);
      // preventDefault 会让轨道拿不到焦点，手动聚焦，键盘才能接着操作
      trackRef.current?.focus({ preventScroll: true });
      setIsDragging(true);
      setValue(getValueFromPointer(e.clientX));
    },
    [getValueFromPointer, setValue, onInteract]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setValue(getValueFromPointer(e.clientX));
    },
    [isDragging, getValueFromPointer, setValue]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next: number | undefined;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = value + step;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = value - step;
          break;
        case "Home":
          next = min;
          break;
        case "End":
          next = max;
          break;
        default:
          return;
      }
      e.preventDefault();
      onInteract?.();
      setValue(next);
    },
    [value, step, min, max, setValue, onInteract]
  );

  const springConfig = shouldReduceMotion
    ? { duration: 0 }
    : { bounce: 0.1, duration: 0.25, type: "spring" as const };

  return (
    <div className={cn("relative w-full select-none", className)}>
      <div
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={Math.round(value)}
        aria-valuetext={valueText}
        className="relative cursor-pointer overflow-hidden bg-[var(--c-surface-2)] outline-offset-2"
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        ref={trackRef}
        role="slider"
        style={{ borderRadius: 8, height: 36, touchAction: "none" }}
        tabIndex={0}
      >
        {/* 已划过的部分 */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-[var(--c-accent-soft)]"
          style={{
            borderRadius: 8,
            transition: isDragging ? "none" : "width 150ms cubic-bezier(0.23, 1, 0.32, 1)",
            width: `${percentage}%`,
          }}
        />

        {ticks > 0 && (
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: ticks }, (_, i) => {
              const pos = ((i + 1) / (ticks + 1)) * 100;
              return (
                <div
                  className="absolute top-1/2 bg-[var(--c-line-strong)]"
                  key={pos}
                  style={{ borderRadius: 999, height: 6, left: `${pos}%`, transform: "translateX(-50%) translateY(-50%)", width: 1 }}
                />
              );
            })}
          </div>
        )}

        {/* 滑块 */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${percentage}%`,
            marginLeft: -5,
            top: "50%",
            transform: "translateX(-50%) translateY(-50%)",
            transition: isDragging ? "none" : "left 150ms cubic-bezier(0.23, 1, 0.32, 1)",
            zIndex: 3,
          }}
        >
          <motion.div
            animate={{ opacity: isActive ? 1 : 0.7, scaleX: isActive ? 1 : 0.8, scaleY: isActive ? 1 : 0.8 }}
            className="bg-[var(--c-accent)]"
            style={{ borderRadius: 999, height: 22, width: 4 }}
            transition={springConfig}
          />
        </div>
      </div>
    </div>
  );
};

export default Scrubber;
