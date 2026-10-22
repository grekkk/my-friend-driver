import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useStore } from "./useStore";
import {
  balance,
  dateLabel,
  emptyData,
  money,
  monthLabel,
  monthly,
  parseBackup,
  previousMonth,
  removeFriend,
  rideLabel,
  sortedEntries,
  today,
  totals,
  type Friend,
  type Theme,
  type Transaction,
} from "./model";
import {
  AnimatedNumber,
  Avatar,
  ConfirmDialog,
  Empty,
  errorMessage,
  Icon,
  Section,
  Sheet,
  type Confirmation,
  type IconName,
} from "./components";
import { DefaultRateForm, EntryForm, FriendForm } from "./forms";
import { CostChart } from "./Chart";

type Tab = "home" | "history" | "analytics" | "settings";
type Panel =
  | { type: "friend"; friend?: Friend; thenRide?: boolean }
  | { type: "detail"; friendId: string }
  | { type: "ride" | "payment"; friendId?: string; entry?: Transaction }
  | { type: "rate" }
  | { type: "install" };
const tabs: { id: Tab; label: string; title: string; icon: IconName }[] = [
  { id: "home", label: "Główna", title: "Twoje rozliczenia", icon: "home" },
  { id: "history", label: "Historia", title: "Historia", icon: "history" },
  { id: "analytics", label: "Analityka", title: "Analityka", icon: "chart" },
  {
    id: "settings",
    label: "Ustawienia",
    title: "Ustawienia",
    icon: "settings",
  },
];
function download(text: string, name: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
function useTheme(theme: Theme) {
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
}
export default function App() {
  const { data, raw, error: storageError, commit } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [toast, setToast] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [historyFriend, setHistoryFriend] = useState("");
  const [period, setPeriod] = useState("all");
  const [historyMonth, setHistoryMonth] = useState(today().slice(0, 7));
  const [visibleHistory, setVisibleHistory] = useState(50);
  const [month, setMonth] = useState(today().slice(0, 7));
  const importRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const updateRequested = useRef(false);
  function reloadAfterUpdate() {
    if (updateRequested.current) {
      updateRequested.current = false;
      window.location.reload();
    }
  }
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: reloadAfterUpdate,
    onRegisterError() {
      setNotice(
        "Tryb offline nie jest jeszcze gotowy. Połącz się z internetem i uruchom aplikację ponownie.",
      );
    },
    onRegisteredSW(_url, registration) {
      if (registration) {
        const check = () => {
          if (navigator.onLine) void registration.update().catch(() => {});
        };
        window.addEventListener("focus", check);
      }
    },
  });
  useTheme(data.settings.theme);
  useEffect(() => {
    navigator.serviceWorker?.addEventListener("controllerchange", reloadAfterUpdate);
    return () => navigator.serviceWorker?.removeEventListener("controllerchange", reloadAfterUpdate);
  }, []);
  async function applyUpdate() {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.waiting) {
        window.location.reload();
        return;
      }
      updateRequested.current = true;
      await updateServiceWorker(true);
      setNeedRefresh(false);
    } catch (error) {
      updateRequested.current = false;
      setNotice(errorMessage(error));
    }
  }
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    document.title = `${tabs.find((t) => t.id === tab)?.label} · My Friend Driver`;
  }, [tab]);
  useEffect(() => {
    setVisibleHistory(50);
  }, [period, historyFriend, historyMonth]);
  function done(message: string) {
    setPanel(null);
    setToast(message);
  }
  function safe(action: () => void) {
    try {
      action();
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }
  function ride(friendId?: string) {
    setPanel(
      data.friends.length
        ? { type: "ride", friendId }
        : { type: "friend", thenRide: true },
    );
  }
  function askDeleteEntry(entry: Transaction) {
    setConfirmation({
      title: "Usunąć wpis?",
      body: `Usuniesz ${entry.type === "ride" ? "przejazd" : "płatność"} z ${dateLabel(entry.date, true)} na kwotę ${money(entry.amount)}. Saldo zostanie przeliczone. Usunięcie opłaconego przejazdu może pozostawić nadpłatę.`,
      action: "Usuń wpis",
      destructive: true,
      onConfirm: () => {
        commit((d) => ({
          ...d,
          transactions: d.transactions.filter((t) => t.id !== entry.id),
        }));
        setConfirmation(null);
        done("Usunięto wpis");
      },
    });
  }
  function askDeleteFriend(friend: Friend) {
    const count = data.transactions.filter(
      (t) => t.friendId === friend.id,
    ).length;
    setConfirmation({
      title: `Usunąć ${friend.name}?`,
      body: `Bezpowrotnie usuniesz znajomego oraz całą powiązaną historię (${count} wpisów). Saldo ${money(Math.abs(balance(data, friend.id)))} również zniknie. Możesz wcześniej wyeksportować dane w Ustawieniach.`,
      action: "Usuń znajomego i historię",
      destructive: true,
      onConfirm: () => {
        commit((d) => removeFriend(d, friend.id));
        setHistoryFriend("");
        setConfirmation(null);
        done("Usunięto znajomego i jego historię");
      },
    });
  }
  function reset() {
    setConfirmation({
      title: "Usunąć wszystkie dane?",
      body: "Usuniesz wszystkich znajomych, przejazdy, płatności i ustawienia. Najpierw zapisz kopię JSON, jeśli chcesz zachować historię.",
      action: "Przejdź dalej",
      destructive: true,
      onConfirm: () => {
        setConfirmation({
          title: "To ostatnie potwierdzenie",
          body: "Tej operacji nie można cofnąć. Usunięte zostaną tylko dane My Friend Driver na tym urządzeniu.",
          action: "Usuń bezpowrotnie",
          destructive: true,
          onConfirm: () => {
            commit(() => emptyData(), true);
            setConfirmation(null);
            setPanel(null);
            setHistoryFriend("");
            setTab("home");
            setToast("Usunięto wszystkie dane aplikacji");
          },
        });
      },
    });
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 15_000_000)
        throw new Error("Plik jest zbyt duży (maksymalnie 15 MB).");
      const imported = parseBackup(await file.text());
      setConfirmation({
        title: "Zastąpić obecne dane?",
        body: `Kopia zawiera ${imported.friends.length} znajomych i ${imported.transactions.length} wpisów. Import zastąpi całą obecną historię i ustawienia. Zachowaj wcześniej kopię obecnych danych.`,
        action: "Importuj i zastąp",
        onConfirm: () => {
          commit(() => imported, true);
          setConfirmation(null);
          setHistoryFriend("");
          setToast("Zaimportowano dane");
        },
      });
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }
  const total = totals(data);
  const thisMonth = monthly(data, today().slice(0, 7));
  const allEntries = sortedEntries(data);
  const recent = allEntries.slice(0, 3);
  const selectedFriend =
    panel?.type === "detail"
      ? data.friends.find((f) => f.id === panel.friendId)
      : undefined;
  const filtered = allEntries.filter(
    (t) =>
      (!historyFriend || t.friendId === historyFriend) &&
      (period === "all" ||
        (period === "month"
          ? t.date.slice(0, 7) === today().slice(0, 7)
          : t.date.slice(0, 7) === historyMonth)),
  );
  const analytics = monthly(data, month);
  const prior = monthly(data, previousMonth(month));
  const delta =
    prior.cost > 0 ? ((analytics.cost - prior.cost) / prior.cost) * 100 : null;
  const [selectedYear, selectedMonth] = month.split("-").map(Number);
  const years = Array.from(
    new Set([
      new Date().getFullYear(),
      selectedYear,
      ...data.transactions.map((t) => Number(t.date.slice(0, 4))),
    ]),
  ).sort((a, b) => b - a);
  const byFriend = data.friends
    .map((friend) => ({ friend, ...monthly(data, month, friend.id) }))
    .filter((f) => f.rides > 0 || f.paid > 0)
    .sort((a, b) => b.cost - a.cost);
  const goHistory = (friendId = "") => {
    setHistoryFriend(friendId);
    setPeriod("all");
    setPanel(null);
    setTab("history");
  };
  function row(entry: Transaction, showDate = true): ReactNode {
    const friend = data.friends.find((f) => f.id === entry.friendId);
    return (
      <button
        key={entry.id}
        className="entry-row"
        onClick={() => setPanel({ type: entry.type, entry })}
      >
        <span className={`entry-icon ${entry.type}`}>
          <Icon name={entry.type === "ride" ? "car" : "payment"} size={21} />
        </span>
        <span className="row-main">
          <strong>
            {entry.type === "ride"
              ? entry.quantity === 1
                ? "Przejazd"
                : rideLabel(entry.quantity)
              : "Płatność"}
            <span className="row-dot"> · </span>
            {friend?.name}
          </strong>
          <span>
            {showDate
              ? dateLabel(entry.date)
              : entry.type === "ride"
                ? `${entry.quantity} × ${money(entry.rate)}${entry.amount !== entry.quantity * entry.rate ? " · własny koszt" : ""}`
                : "Zarejestrowane rozliczenie"}
            {entry.note ? ` · ${entry.note}` : ""}
          </span>
        </span>
        <span
          className={`row-amount number ${entry.type === "payment" ? "positive" : ""}`}
        >
          {entry.type === "payment" ? "−" : "+"}
          {money(entry.amount)}
        </span>
        <Icon name="arrow" size={14} />
      </button>
    );
  }
  const settingsRow = (
    icon: IconName,
    label: string,
    action: () => void,
    value?: string,
    danger = false,
  ) => (
    <button
      className={`settings-row ${danger ? "danger" : ""}`}
      onClick={action}
    >
      <Icon name={icon} size={21} />
      <span>{label}</span>
      {value && <span className="settings-value">{value}</span>}
      <Icon name="arrow" size={14} />
    </button>
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <Icon name="car" size={25} />
          <span>My Friend Driver</span>
        </div>
        <span className="local-status">
          <Icon name={!online ? "offline" : "shield"} size={15} />
          {!online ? "Offline" : "Tylko na Twoim urządzeniu"}
        </span>
      </header>
      <main ref={mainRef} id="main-content">
        <div className="view" key={tab}>
          <div className="page-heading">
            <div>
              <p className="page-kicker">
                {tab === "home" ? dateLabel(today(), true) : "My Friend Driver"}
              </p>
              <h1>{tabs.find((t) => t.id === tab)?.title}</h1>
            </div>
            {tab === "home" && (
              <button
                className="icon-button add-person"
                aria-label="Dodaj znajomego"
                onClick={() => setPanel({ type: "friend" })}
              >
                <Icon name="people" />
              </button>
            )}
          </div>
          {storageError && (
            <div className="notice" role="alert">
              <Icon name="info" />
              <div>
                <p>{storageError}</p>
                {raw !== null && (
                  <button
                    className="link"
                    onClick={() =>
                      download(
                        raw,
                        `my-friend-driver-odzyskiwanie-${today()}.json`,
                      )
                    }
                  >
                    Pobierz oryginalne dane
                  </button>
                )}
                <button className="link" onClick={() => setTab("settings")}>
                  Przejdź do danych
                </button>
              </div>
            </div>
          )}
          {notice && (
            <div className="notice" role="alert">
              <Icon name="info" />
              <p>{notice}</p>
              <button
                className="icon-button"
                aria-label="Zamknij komunikat"
                onClick={() => setNotice("")}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          )}
          {needRefresh && (
            <div className="update-notice">
              <div>
                <strong>Nowa wersja jest gotowa</strong>
                <p>
                  {panel
                    ? "Zakończ edycję, aby zaktualizować."
                    : "Zapisana historia pozostanie na urządzeniu."}
                </p>
              </div>
              <button
                className="link"
                disabled={!!panel}
                onClick={() => void applyUpdate()}
              >
                Aktualizuj
              </button>
            </div>
          )}
          {tab === "home" && (
            <>
              <section
                className="balance-card"
                aria-label="Podsumowanie należności"
              >
                <div className="balance-top">
                  <span className="balance-label">Pozostało do zapłaty</span>
                  <span className="balance-symbol">
                    <Icon name="car" size={26} />
                  </span>
                </div>
                <AnimatedNumber
                  value={total.debt}
                  currency
                  className="balance-number"
                />
                <p className="balance-caption">
                  {!data.friends.length
                    ? "Dobry początek wspólnych rozliczeń."
                    : total.debt === 0
                      ? "Wszystko rozliczone. Szerokiej drogi!"
                      : `Łącznie u ${data.friends.filter((f) => balance(data, f.id) > 0).length} ${data.friends.filter((f) => balance(data, f.id) > 0).length === 1 ? "znajomego" : "znajomych"}`}
                </p>
                {total.credit > 0 && (
                  <p className="credit-note">
                    Nadpłata u znajomych: {money(total.credit)}. Pomniejszy
                    kolejne należności u tych osób.
                  </p>
                )}
                <div className="balance-footer">
                  <div>
                    <span>Przejazdy w miesiącu</span>
                    <strong>
                      <AnimatedNumber value={thisMonth.rides} />
                    </strong>
                  </div>
                  <div>
                    <span>Zapłacono w miesiącu</span>
                    <strong>
                      <AnimatedNumber value={thisMonth.paid} currency />
                    </strong>
                  </div>
                </div>
              </section>
              <div className="home-columns">
                <Section
                  title="Znajomi"
                  action={
                    <button
                      className="link"
                      onClick={() => setPanel({ type: "friend" })}
                    >
                      <Icon name="plus" size={16} /> Dodaj
                    </button>
                  }
                >
                  <div className="grouped-list friend-list">
                    {data.friends.length ? (
                      data.friends.map((friend) => {
                        const value = balance(data, friend.id);
                        return (
                          <button
                            key={friend.id}
                            className="friend-row"
                            onClick={() =>
                              setPanel({ type: "detail", friendId: friend.id })
                            }
                          >
                            <Avatar name={friend.name} identity={friend.id} />
                            <span className="row-main">
                              <strong>{friend.name}</strong>
                              <span>{money(friend.rate)} za przejazd</span>
                            </span>
                            <span className="friend-balance">
                              <strong className="number">
                                {money(Math.abs(value))}
                              </strong>
                              <span>
                                {value < 0
                                  ? "nadpłata"
                                  : value === 0
                                    ? "rozliczone"
                                    : "do zapłaty"}
                              </span>
                            </span>
                            <Icon name="arrow" size={14} />
                          </button>
                        );
                      })
                    ) : (
                      <Empty icon="people" title="Z kim jeździsz?">
                        Dodaj pierwszego znajomego i jego stawkę. Resztę
                        policzymy za Ciebie.
                      </Empty>
                    )}
                  </div>
                </Section>
                <Section
                  title="Ostatnie operacje"
                  action={
                    recent.length ? (
                      <button className="link" onClick={() => goHistory()}>
                        Wszystkie <Icon name="arrow" size={13} />
                      </button>
                    ) : undefined
                  }
                >
                  <div className="grouped-list">
                    {recent.length ? (
                      recent.map((entry) => row(entry))
                    ) : (
                      <Empty icon="history" title="Historia zaczyna się tutaj">
                        Twoje przejazdy i płatności będą zawsze w jednym
                        miejscu.
                      </Empty>
                    )}
                  </div>
                </Section>
              </div>
              <p className="privacy-line">
                <Icon name="shield" size={15} /> Twoje sprawy zostają między
                Wami.
              </p>
            </>
          )}
          {tab === "history" && (
            <>
              <div className="history-filters">
                <label className="filter-select">
                  <span className="sr-only">Filtruj po znajomym</span>
                  <select
                    value={historyFriend}
                    onChange={(e) => setHistoryFriend(e.target.value)}
                  >
                    <option value="">Wszyscy znajomi</option>
                    {data.friends.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="filter-select">
                  <span className="sr-only">Okres historii</span>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="all">Cała historia</option>
                    <option value="month">Ten miesiąc</option>
                    <option value="custom">Wybierz miesiąc</option>
                  </select>
                </label>
              </div>
              {period === "custom" && (
                <label className="month-input">
                  Miesiąc historii
                  <input
                    type="month"
                    min="1900-01"
                    max="9999-12"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                  />
                </label>
              )}
              <p className="list-caption">
                {filtered.length} {filtered.length === 1 ? "wpis" : "wpisów"}
                {historyFriend &&
                  " · " +
                    (data.friends.find((f) => f.id === historyFriend)?.name ??
                      "")}
              </p>
              {!filtered.length ? (
                <div className="grouped-list">
                  <Empty
                    icon="history"
                    title={
                      data.transactions.length
                        ? "Brak wpisów w tym okresie"
                        : "Jeszcze bez przejazdów"
                    }
                  >
                    {data.transactions.length
                      ? "Wybierz inny miesiąc lub znajomego."
                      : "Dodaj przejazd. Tutaj znajdziesz całą historię rozliczeń."}
                  </Empty>
                </div>
              ) : (
                <div className="history-groups">
                  {Array.from(
                    new Set(
                      filtered.slice(0, visibleHistory).map((t) => t.date),
                    ),
                  ).map((date) => (
                    <section key={date}>
                      <h2 className="date-heading">
                        {date === today() ? "Dzisiaj" : dateLabel(date, true)}
                      </h2>
                      <div className="grouped-list">
                        {filtered
                          .slice(0, visibleHistory)
                          .filter((t) => t.date === date)
                          .map((entry) => row(entry, false))}
                      </div>
                    </section>
                  ))}
                  {filtered.length > visibleHistory && (
                    <button
                      className="secondary wide"
                      onClick={() => setVisibleHistory((n) => n + 50)}
                    >
                      Pokaż kolejne wpisy ({visibleHistory} z {filtered.length})
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {tab === "analytics" && (
            <>
              <div className="analytics-period">
                <label>
                  <span className="sr-only">Miesiąc analityki</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) =>
                      setMonth(
                        `${selectedYear}-${String(e.target.value).padStart(2, "0")}`,
                      )
                    }
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {new Intl.DateTimeFormat("pl-PL", {
                          month: "long",
                        }).format(new Date(2024, i, 1))}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Rok analityki</span>
                  <select
                    value={selectedYear}
                    onChange={(e) =>
                      setMonth(
                        `${e.target.value}-${String(selectedMonth).padStart(2, "0")}`,
                      )
                    }
                  >
                    {years.map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                  </select>
                </label>
              </div>
              <section className="analytics-card">
                <span className="balance-label">
                  Koszt przejazdów · {monthLabel(month)}
                </span>
                <AnimatedNumber
                  value={analytics.cost}
                  currency
                  className="analytics-total"
                />
                <p className="comparison">
                  {delta === null ? (
                    "Brak kosztów w poprzednim miesiącu do porównania."
                  ) : (
                    <>
                      <span
                        className={
                          delta > 0 ? "more-cost" : delta < 0 ? "positive" : ""
                        }
                      >
                        {delta > 0 ? "+" : ""}
                        {new Intl.NumberFormat("pl-PL", {
                          maximumFractionDigits: 1,
                        }).format(delta)}
                        %
                      </span>{" "}
                      względem poprzedniego miesiąca
                    </>
                  )}
                </p>
                <div className="analytics-pair">
                  <div>
                    <span>Przejazdy</span>
                    <strong>
                      <AnimatedNumber value={analytics.rides} />
                    </strong>
                  </div>
                  <div>
                    <span>Faktycznie zapłacono</span>
                    <strong>
                      <AnimatedNumber value={analytics.paid} currency />
                    </strong>
                  </div>
                </div>
              </section>
              <div className="analytics-columns">
                <Section title={`Koszty w ${selectedYear} roku`}>
                  <div className="grouped-list chart-panel">
                    <CostChart
                      data={data}
                      year={selectedYear}
                      selectedMonth={selectedMonth}
                      onSelect={(m) =>
                        setMonth(
                          `${selectedYear}-${String(m).padStart(2, "0")}`,
                        )
                      }
                    />
                  </div>
                </Section>
                <Section title="Według znajomych">
                  <div className="grouped-list">
                    {byFriend.length ? (
                      byFriend.map(({ friend, cost, rides, paid }) => (
                        <div
                          className="friend-row analytics-friend"
                          key={friend.id}
                        >
                          <Avatar name={friend.name} identity={friend.id} />
                          <span className="row-main">
                            <strong>{friend.name}</strong>
                            <span>
                              {rideLabel(rides)} · zapłacono {money(paid)}
                            </span>
                          </span>
                          <strong className="number">{money(cost)}</strong>
                        </div>
                      ))
                    ) : (
                      <Empty icon="chart" title="Spokojny miesiąc">
                        Nie masz przejazdów ani płatności w wybranym miesiącu.
                      </Empty>
                    )}
                  </div>
                </Section>
              </div>
              <Section title="Zestawienie">
                <div className="grouped-list key-values">
                  <div>
                    <span>
                      Poprzedni miesiąc · {monthLabel(previousMonth(month))}
                    </span>
                    <strong>
                      <AnimatedNumber value={prior.cost} currency />
                    </strong>
                  </div>
                  <div>
                    <span>Do zapłaty ze wszystkich miesięcy</span>
                    <strong>
                      <AnimatedNumber value={total.debt} currency />
                    </strong>
                  </div>
                  {total.credit > 0 && (
                    <div>
                      <span>Nadpłata u znajomych</span>
                      <strong>{money(total.credit)}</strong>
                    </div>
                  )}
                </div>
                <p className="section-note">
                  Koszty według dat przejazdów. Płatności według dat rozliczeń.
                  Aktualne saldo obejmuje całą historię.
                </p>
              </Section>
            </>
          )}
          {tab === "settings" && (
            <div className="settings-layout">
              <Section title="Wygląd">
                <div className="grouped-list settings-padding">
                  <div className="settings-label">
                    <Icon name="sun" size={21} />
                    <span>Motyw aplikacji</span>
                  </div>
                  <div
                    className="segmented"
                    role="group"
                    aria-label="Motyw aplikacji"
                  >
                    {(
                      [
                        { id: "light", label: "Jasny" },
                        { id: "dark", label: "Ciemny" },
                        { id: "system", label: "Systemowy" },
                      ] as const
                    ).map((theme) => (
                      <button
                        key={theme.id}
                        aria-pressed={data.settings.theme === theme.id}
                        onClick={() =>
                          safe(() => {
                            commit((d) => ({
                              ...d,
                              settings: { ...d.settings, theme: theme.id },
                            }));
                            setToast("Zapisano motyw");
                          })
                        }
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>
              <Section title="Przejazdy">
                <div className="grouped-list">
                  {settingsRow(
                    "car",
                    "Domyślna stawka",
                    () => setPanel({ type: "rate" }),
                    money(data.settings.defaultRate),
                  )}
                  <label className="switch-row settings-switch">
                    <Icon name="people" size={21} />
                    <span>Zapamiętuj znajomego</span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={data.settings.rememberFriend}
                      onChange={(e) =>
                        safe(() => {
                          const checked = e.target.checked;
                          commit((d) => ({
                            ...d,
                            settings: {
                              ...d.settings,
                              rememberFriend: checked,
                            },
                          }));
                          setToast("Zapisano preferencję");
                        })
                      }
                    />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                </div>
                <p className="section-note">
                  Ostatnio wybrany znajomy uzupełni się przy kolejnym
                  przejeździe.
                </p>
              </Section>
              <Section title="Twoje dane">
                <div className="grouped-list">
                  {settingsRow("download", "Eksportuj kopię JSON", () =>
                    safe(() => {
                      if (storageError)
                        throw new Error(
                          "Zapisane dane wymagają odzyskania. Użyj opcji pobrania oryginału w komunikacie.",
                        );
                      download(
                        JSON.stringify(data, null, 2),
                        `my-friend-driver-${today()}.json`,
                      );
                      setToast("Przygotowano kopię danych");
                    }),
                  )}
                  {settingsRow("upload", "Importuj kopię JSON", () =>
                    importRef.current?.click(),
                  )}
                </div>
                <p className="section-note">
                  Dane są tylko w tej przeglądarce. Regularnie zapisuj kopię
                  JSON. Wyczyszczenie danych witryny, utrata urządzenia lub
                  usunięcie pamięci przez system mogą usunąć historię.
                </p>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  aria-label="Plik kopii JSON"
                  onChange={(e) => {
                    void importFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </Section>
              <Section title="Aplikacja">
                <div className="grouped-list">
                  {settingsRow("plus", "Dodaj do ekranu początkowego", () =>
                    setPanel({ type: "install" }),
                  )}
                  <div className="settings-row static">
                    <Icon name="offline" size={21} />
                    <span>Tryb offline</span>
                    <span className="settings-value">
                      {offlineReady
                        ? "Gotowy"
                        : navigator.serviceWorker?.controller
                          ? "Aktywny"
                          : import.meta.env.DEV
                            ? "Po publikacji"
                            : "Przygotowywanie"}
                    </span>
                  </div>
                  <div className="settings-row static">
                    <Icon name="info" size={21} />
                    <span>My Friend Driver</span>
                    <span className="settings-value">1.0.0</span>
                  </div>
                </div>
                <p className="section-note">
                  Bez konta, lokalizacji i synchronizacji. Wszystkie obliczenia
                  odbywają się na Twoim urządzeniu.
                </p>
              </Section>
              <Section title="Usuwanie danych" className="reset-section">
                <div className="grouped-list">
                  {settingsRow(
                    "trash",
                    "Usuń wszystkie dane",
                    reset,
                    undefined,
                    true,
                  )}
                </div>
              </Section>
              <p className="app-signature">
                <Icon name="car" size={24} />
                <span>My Friend Driver</span>
                <span>Wspólne przejazdy. Jasne rozliczenia.</span>
              </p>
            </div>
          )}
        </div>
      </main>
      {(tab === "home" || tab === "history") && (
        <div className="action-dock">
          <button className="primary ride-button" onClick={() => ride()}>
            <Icon name="plus" size={23} /> Przejazd
          </button>
          <button
            className="secondary payment-button"
            onClick={() =>
              data.friends.length
                ? setPanel({ type: "payment" })
                : setPanel({ type: "friend" })
            }
          >
            <Icon name="payment" size={21} /> Płatność
          </button>
        </div>
      )}
      <nav className="tab-bar" aria-label="Nawigacja główna">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            <span className="tab-icon">
              <Icon name={item.icon} size={23} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {panel && (
        <Sheet
          key={
            panel.type +
            ("entry" in panel ? (panel.entry?.id ?? "") : "") +
            ("friend" in panel ? (panel.friend?.id ?? "") : "")
          }
          title={
            panel.type === "friend"
              ? panel.friend
                ? "Edytuj znajomego"
                : "Nowy znajomy"
              : panel.type === "detail"
                ? (selectedFriend?.name ?? "Znajomy")
                : panel.type === "rate"
                  ? "Domyślna stawka"
                  : panel.type === "install"
                    ? "Zawsze pod ręką"
                    : panel.entry
                      ? panel.type === "ride"
                        ? "Edytuj przejazd"
                        : "Edytuj płatność"
                      : panel.type === "ride"
                        ? "Nowy przejazd"
                        : "Nowa płatność"
          }
          onClose={() => setPanel(null)}
        >
          {panel.type === "friend" && (
            <FriendForm
              data={data}
              friend={panel.friend}
              commit={commit}
              done={(message) => {
                if (panel.thenRide) {
                  setPanel({ type: "ride" });
                  setToast(message);
                } else done(message);
              }}
            />
          )}
          {(panel.type === "ride" || panel.type === "payment") && (
            <>
              <EntryForm
                data={data}
                type={panel.type}
                entry={panel.entry}
                friendId={panel.friendId}
                commit={commit}
                done={done}
              />
              {panel.entry && (
                <button
                  className="danger delete-entry"
                  onClick={() => askDeleteEntry(panel.entry!)}
                >
                  <Icon name="trash" size={17} /> Usuń wpis
                </button>
              )}
            </>
          )}
          {panel.type === "rate" && (
            <DefaultRateForm data={data} commit={commit} done={done} />
          )}
          {panel.type === "detail" && selectedFriend && (
            <div className="friend-detail">
              <Avatar name={selectedFriend.name} identity={selectedFriend.id} />
              <p className="balance-label">
                {balance(data, selectedFriend.id) < 0
                  ? "Nadpłata"
                  : "Do zapłaty"}
              </p>
              <AnimatedNumber
                value={Math.abs(balance(data, selectedFriend.id))}
                currency
                className="detail-amount"
              />
              <p className="muted">{money(selectedFriend.rate)} za przejazd</p>
              {balance(data, selectedFriend.id) < 0 && (
                <p className="section-note">
                  Nadpłata pomniejszy koszt kolejnych przejazdów z tym znajomym.
                </p>
              )}
              <div className="detail-actions">
                <button
                  className="primary"
                  onClick={() => ride(selectedFriend.id)}
                >
                  <Icon name="plus" size={18} /> Przejazd
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    setPanel({ type: "payment", friendId: selectedFriend.id })
                  }
                >
                  <Icon name="payment" size={19} /> Płatność
                </button>
              </div>
              <div className="grouped-list">
                {settingsRow("history", "Historia rozliczeń", () =>
                  goHistory(selectedFriend.id),
                )}
                {settingsRow("edit", "Edytuj znajomego", () =>
                  setPanel({ type: "friend", friend: selectedFriend }),
                )}
                {settingsRow(
                  "trash",
                  "Usuń znajomego",
                  () => askDeleteFriend(selectedFriend),
                  undefined,
                  true,
                )}
              </div>
            </div>
          )}
          {panel.type === "install" && <InstallInstructions />}
        </Sheet>
      )}
      {confirmation && (
        <ConfirmDialog
          key={confirmation.title}
          config={confirmation}
          onClose={() => setConfirmation(null)}
        />
      )}
      <div
        className="toast-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast && (
          <div className="toast" key={toast}>
            <Icon name="check" size={17} />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
function InstallInstructions() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone);
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return (
    <div className="install-instructions">
      <div className="install-mark">
        <Icon name="car" size={40} />
      </div>
      <h3>My Friend Driver</h3>
      {standalone ? (
        <p>
          Aplikacja jest już otwarta w trybie samodzielnym. Wszystko gotowe.
        </p>
      ) : ios ? (
        <>
          <p>Otwórz aplikację w Safari i dodaj ją do ekranu początkowego.</p>
          <ol>
            <li>
              Naciśnij przycisk <strong>Udostępnij</strong>{" "}
              <Icon name="share" size={18} />.
            </li>
            <li>
              Wybierz <strong>Do ekranu początkowego</strong>. Jeśli opcja jest
              ukryta, przewiń listę czynności.
            </li>
            <li>
              Potwierdź przyciskiem <strong>Dodaj</strong>. Jeśli widzisz opcję
              „Otwieraj jako aplikację”, pozostaw ją włączoną.
            </li>
          </ol>
        </>
      ) : (
        <>
          <p>
            W Chrome lub Edge otwórz menu przeglądarki i wybierz{" "}
            <strong>Zainstaluj aplikację</strong> lub{" "}
            <strong>Dodaj do ekranu głównego</strong>, jeśli opcja jest
            dostępna.
          </p>
          <p>
            W innych przeglądarkach skorzystaj z ich opcji instalacji lub dodaj
            zakładkę.
          </p>
        </>
      )}
      <p className="field-note">
        Po pierwszym pełnym załadowaniu aplikacja działa bez internetu.
        Instalacja i zwykła karta przeglądarki mogą mieć oddzielną pamięć —
        zachowaj kopię JSON przed przenoszeniem danych.
      </p>
    </div>
  );
}
