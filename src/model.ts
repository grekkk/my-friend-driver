export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = "my-friend-driver:data";
export const MAX_MONEY = 100_000_000_000;
export type Theme = "system" | "light" | "dark";
export interface Friend {
  id: string;
  name: string;
  rate: number;
}
interface Entry {
  id: string;
  friendId: string;
  date: string;
  amount: number;
  note: string;
  createdAt: string;
}
export interface Ride extends Entry {
  type: "ride";
  quantity: number;
  rate: number;
}
export interface Payment extends Entry {
  type: "payment";
}
export type Transaction = Ride | Payment;
export interface Settings {
  theme: Theme;
  defaultRate: number;
  rememberFriend: boolean;
  lastFriendId: string | null;
}
export interface AppData {
  version: 2;
  friends: Friend[];
  transactions: Transaction[];
  settings: Settings;
}

export const emptyData = (): AppData => ({
  version: 2,
  friends: [],
  transactions: [],
  settings: {
    theme: "system",
    defaultRate: 500,
    rememberFriend: true,
    lastFriendId: null,
  },
});
export const id = () => crypto.randomUUID();
export const today = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1)
    return false;
  return day <= new Date(year, month, 0).getDate();
}
export const monthOf = (date: string) => date.slice(0, 7);
export function rideLabel(count: number) {
  const last = count % 10,
    lastTwo = count % 100;
  return `${count} ${count === 1 ? "przejazd" : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "przejazdy" : "przejazdów"}`;
}
export function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
export function money(cents: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(cents / 100);
}
export function moneyInput(cents: number) {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}
export function parseMoney(value: string): number {
  const clean = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(clean))
    throw new Error("Wpisz kwotę z maksymalnie dwoma miejscami po przecinku.");
  const [whole, fraction = ""] = clean.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > MAX_MONEY)
    throw new Error("Ta kwota jest zbyt duża.");
  return result;
}
export const dateLabel = (date: string, long = false) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d, 12));
};
export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1, 12));
};
export function balance(data: AppData, friendId?: string) {
  return data.transactions.reduce(
    (sum, entry) =>
      !friendId || entry.friendId === friendId
        ? sum + (entry.type === "ride" ? entry.amount : -entry.amount)
        : sum,
    0,
  );
}
export function totals(data: AppData) {
  return data.friends.reduce(
    (sum, friend) => {
      const value = balance(data, friend.id);
      return {
        debt: sum.debt + Math.max(0, value),
        credit: sum.credit + Math.max(0, -value),
      };
    },
    { debt: 0, credit: 0 },
  );
}
export function monthly(data: AppData, month: string, friendId?: string) {
  return data.transactions.reduce(
    (sum, entry) => {
      if (
        monthOf(entry.date) !== month ||
        (friendId && entry.friendId !== friendId)
      )
        return sum;
      return entry.type === "ride"
        ? {
            ...sum,
            cost: sum.cost + entry.amount,
            rides: sum.rides + entry.quantity,
          }
        : { ...sum, paid: sum.paid + entry.amount };
    },
    { cost: 0, rides: 0, paid: 0 },
  );
}
export function sortedEntries(data: AppData) {
  return [...data.transactions].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
}
export function saveEntry(data: AppData, entry: Transaction): AppData {
  if (entry.type === "payment") {
    const without = {
      ...data,
      transactions: data.transactions.filter((t) => t.id !== entry.id),
    };
    const available = Math.max(0, balance(without, entry.friendId));
    if (entry.amount > available)
      throw new Error(
        `Do rozliczenia jest ${money(available)}. Zmniejsz kwotę płatności.`,
      );
  }
  const transactions = data.transactions.some((t) => t.id === entry.id)
    ? data.transactions.map((t) => (t.id === entry.id ? entry : t))
    : [...data.transactions, entry];
  return validateData({
    ...data,
    transactions,
    settings: { ...data.settings, lastFriendId: entry.friendId },
  });
}
export function removeFriend(data: AppData, friendId: string): AppData {
  return {
    ...data,
    friends: data.friends.filter((f) => f.id !== friendId),
    transactions: data.transactions.filter((t) => t.friendId !== friendId),
    settings: {
      ...data.settings,
      lastFriendId:
        data.settings.lastFriendId === friendId
          ? null
          : data.settings.lastFriendId,
    },
  };
}

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const positiveInt = (v: unknown, max: number, min = 0): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
function fail(): never {
  throw new Error(
    "Nieprawidłowy format danych. Wybierz kopię JSON wyeksportowaną z My Friend Driver.",
  );
}
export function validateData(input: unknown): AppData {
  if (!record(input)) return fail();
  if (typeof input.version === "number" && input.version > SCHEMA_VERSION)
    throw new Error(
      "Ta kopia pochodzi z nowszej wersji aplikacji. Najpierw zaktualizuj aplikację.",
    );
  if (input.version !== 1 && input.version !== 2) return fail();
  if (
    !Array.isArray(input.friends) ||
    !Array.isArray(input.transactions) ||
    input.friends.length > 1000 ||
    input.transactions.length > 50_000
  )
    return fail();
  if (!record(input.settings)) return fail();
  const settings = input.settings;
  if (
    !["system", "light", "dark"].includes(String(settings.theme)) ||
    !positiveInt(settings.defaultRate, MAX_MONEY)
  )
    return fail();
  if (
    input.version === 2 &&
    (typeof settings.rememberFriend !== "boolean" ||
      !(settings.lastFriendId === null || text(settings.lastFriendId, 100)))
  )
    return fail();
  const ids = new Set<string>();
  function unique(v: unknown): v is string {
    if (!text(v, 100) || !v || ids.has(v)) return false;
    ids.add(v);
    return true;
  }
  const friends: Friend[] = input.friends.map((f: unknown) => {
    if (
      !record(f) ||
      !unique(f.id) ||
      !text(f.name, 60) ||
      !f.name.trim() ||
      !positiveInt(f.rate, MAX_MONEY)
    )
      return fail();
    return { id: f.id, name: f.name.trim(), rate: f.rate };
  });
  const friendIds = new Set(friends.map((f) => f.id));
  let cost = 0,
    paid = 0;
  const transactions: Transaction[] = input.transactions.map((t: unknown) => {
    if (
      !record(t) ||
      !unique(t.id) ||
      !text(t.friendId, 100) ||
      !friendIds.has(t.friendId) ||
      !validDate(t.date) ||
      !positiveInt(t.amount, MAX_MONEY) ||
      !text(t.note, 500) ||
      !text(t.createdAt, 40) ||
      !Number.isFinite(Date.parse(t.createdAt))
    )
      return fail();
    const common = {
      id: t.id,
      friendId: t.friendId,
      date: t.date,
      amount: t.amount,
      note: t.note,
      createdAt: t.createdAt,
    };
    if (
      t.type === "ride" &&
      positiveInt(t.quantity, 999, 1) &&
      positiveInt(t.rate, MAX_MONEY)
    ) {
      cost += t.amount;
      return { ...common, type: "ride", quantity: t.quantity, rate: t.rate };
    }
    if (t.type === "payment" && t.amount > 0) {
      paid += t.amount;
      return { ...common, type: "payment" };
    }
    return fail();
  });
  if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(paid)) return fail();
  const lastFriendId =
    typeof settings.lastFriendId === "string" &&
    friendIds.has(settings.lastFriendId)
      ? settings.lastFriendId
      : null;
  return {
    version: 2,
    friends,
    transactions,
    settings: {
      theme: settings.theme as Theme,
      defaultRate: settings.defaultRate,
      rememberFriend:
        input.version === 1 ? true : (settings.rememberFriend as boolean),
      lastFriendId,
    },
  };
}
export function parseBackup(json: string) {
  if (json.length > 15_000_000)
    throw new Error("Plik jest zbyt duży (maksymalnie 15 MB).");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Nie można odczytać pliku JSON. Plik może być uszkodzony.");
  }
  return validateData(parsed);
}
