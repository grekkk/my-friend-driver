import { CountUp } from "countup.js";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { money } from "./model";

const paths = {
  car: (
    <>
      <path d="m5 8 1.5-4h11L19 8M4 8h16a1 1 0 0 1 1 1v8H3V9a1 1 0 0 1 1-1ZM5 17v3m14-3v3M7 12h.01M17 12h.01M8 17h8" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3V10Z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  history: (
    <>
      <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h17M6 16V9m6 7V4m6 12v-5" />
    </>
  ),
  settings: (
    <>
      <path
        d="m9 4 1-2h4l1 2 3 2 2 .3 2 3.4-1 2.3v3l1 2.3-2 3.4-2-.2-3 1.5-1 2h-4l-1-2-3-1.5-2 .2-2-3.4L3 14v-3L2 8.7l2-3.4L6 6l3-2Z"
        transform="translate(1 0) scale(.9)"
      />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="m9 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  payment: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 21v-2a7 7 0 0 1 14 0v2M16 5a3.5 3.5 0 0 1 0 7m3 9v-2a7 7 0 0 0-3-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-5 5 5-5 5 5M4 15v6h16v-6" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.01" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  share: (
    <>
      <path d="M12 16V2m-4 4 4-4 4 4M7 9H4v13h16V9h-3" />
    </>
  ),
  offline: (
    <>
      <path d="m3 3 18 18M2 8a17 17 0 0 1 3-2m4-2a17 17 0 0 1 13 4M5 12a12 12 0 0 1 4-2m5 0a12 12 0 0 1 5 2M9 16a5 5 0 0 1 6 0M12 20h.01" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  edit: (
    <>
      <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z" />
    </>
  ),
};
export type IconName = keyof typeof paths;
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function AnimatedNumber({
  value,
  currency = false,
  className = "",
}: {
  value: number;
  currency?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const instance = useRef<CountUp | null>(null);
  const previous = useRef(value);
  const format = currency
    ? money
    : (n: number) => new Intl.NumberFormat("pl-PL").format(n);
  useEffect(() => {
    if (!ref.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const render = () => {
      instance.current?.reset();
      instance.current = null;
      if (ref.current) ref.current.textContent = format(value);
    };
    if (reduced.matches) render();
    else if (!instance.current) {
      instance.current = new CountUp(ref.current, value, {
        startVal: previous.current,
        duration: 0.38,
        useEasing: true,
        decimalPlaces: 0,
        formattingFn: format,
      });
      if (!instance.current.error) instance.current.start();
      else render();
    } else instance.current.update(value);
    previous.current = value;
    const onChange = () => {
      if (reduced.matches) render();
    };
    reduced.addEventListener("change", onChange);
    return () => reduced.removeEventListener("change", onChange);
    // Currency is constant for the lifetime of a number. Updates animate only when its value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency]);
  useEffect(
    () => () => {
      instance.current?.pauseResume();
      instance.current = null;
    },
    [],
  );
  return (
    <span className={`number ${className}`} aria-label={format(value)}>
      <span aria-hidden="true" ref={ref}>
        {format(value)}
      </span>
    </span>
  );
}
export function Avatar({ name, identity }: { name: string; identity: string }) {
  const hue = [...identity].reduce((n, c) => n + c.charCodeAt(0), 0) % 6;
  return (
    <span className={`avatar avatar-${hue}`} aria-hidden="true">
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toLocaleUpperCase("pl")}
    </span>
  );
}
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    ref.current?.showModal();
    const scroll = document.querySelector("main");
    const previous = scroll instanceof HTMLElement ? scroll.style.overflow : "";
    if (scroll instanceof HTMLElement) scroll.style.overflow = "hidden";
    return () => {
      if (scroll instanceof HTMLElement) scroll.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-modal="true"
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-header">
        <h2 id={headingId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Zamknij panel"
          onClick={onClose}
          autoFocus
        >
          <Icon name="close" size={20} />
        </button>
      </header>
      <div className="sheet-content">{children}</div>
    </dialog>
  );
}
export interface Confirmation {
  title: string;
  body: string;
  action: string;
  onConfirm: () => void;
  destructive?: boolean;
}
export function ConfirmDialog({
  config,
  onClose,
}: {
  config: Confirmation;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirmation"
      aria-modal="true"
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id={headingId}>{config.title}</h2>
      <p>{config.body}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="confirm-actions">
        <button autoFocus onClick={onClose}>
          Anuluj
        </button>
        <button
          className={config.destructive ? "danger" : "link"}
          onClick={() => {
            try {
              config.onConfirm();
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          {config.action}
        </button>
      </div>
    </dialog>
  );
}
export const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Nie udało się wykonać tej operacji. Spróbuj ponownie.";
export function Empty({
  icon = "car",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">
        <Icon name={icon} size={32} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section ${className}`}>
      <div className="section-title">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
