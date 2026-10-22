import { describe, expect, it } from "vitest";
import {
  balance,
  emptyData,
  money,
  monthly,
  parseBackup,
  parseMoney,
  previousMonth,
  removeFriend,
  saveEntry,
  today,
  totals,
  validDate,
  validateData,
  type AppData,
  type Payment,
  type Ride,
} from "../src/model";
import { loadData, persistData, type StorageLike } from "../src/storage";

function fixture(): AppData {
  return {
    ...emptyData(),
    friends: [{ id: "friend", name: "Kuba", rate: 550 }],
  };
}
function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    id: "ride",
    type: "ride",
    friendId: "friend",
    date: "2026-10-31",
    quantity: 2,
    rate: 550,
    amount: 1100,
    note: "",
    createdAt: "2026-10-31T12:00:00.000Z",
    ...overrides,
  };
}
function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment",
    type: "payment",
    friendId: "friend",
    date: "2026-11-01",
    amount: 600,
    note: "",
    createdAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
  };
}
function memory(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
describe("Kwoty w groszach", () => {
  it.each([
    ["5,50", 550],
    ["5.5", 550],
    ["0,29", 29],
    [" 1 000,01 ", 100001],
    ["0", 0],
    ["0001,01", 101],
  ])("parsuje %s bez błędów zmiennoprzecinkowych", (input, expected) =>
    expect(parseMoney(input)).toBe(expected),
  );
  it.each(["-1", "1.001", "NaN", "1e5", "", "1,2,3", ".5", "1000000001,00"])(
    "odrzuca %s",
    (input) => expect(() => parseMoney(input)).toThrow(),
  );
  it("formatuje PLN z dwoma cyframi i polskim przecinkiem", () => {
    expect(money(550).replace(/\s/g, " ")).toBe("5,50 zł");
    expect(money(0).replace(/\s/g, " ")).toBe("0,00 zł");
    expect(parseMoney("0,10") + parseMoney("0,20")).toBe(30);
  });
});
describe("Historia i salda", () => {
  it("dodaje znajomego i wiele przejazdów, zmiana stawki nie zmienia historii", () => {
    let d = saveEntry(fixture(), ride());
    d = { ...d, friends: [{ ...d.friends[0], name: "Jakub", rate: 700 }] };
    expect(d.transactions[0].amount).toBe(1100);
    expect(d.transactions[0].type === "ride" && d.transactions[0].rate).toBe(
      550,
    );
    d = saveEntry(
      d,
      ride({ id: "ride2", rate: 700, quantity: 3, amount: 2100 }),
    );
    expect(balance(d, "friend")).toBe(3200);
    expect(monthly(d, "2026-10").rides).toBe(5);
  });
  it("rozlicza część i całość, a potem blokuje dalszą płatność", () => {
    let d = saveEntry(saveEntry(fixture(), ride()), payment());
    expect(balance(d)).toBe(500);
    d = saveEntry(d, payment({ id: "payment2", amount: 500 }));
    expect(balance(d)).toBe(0);
    expect(() => saveEntry(d, payment({ id: "payment3", amount: 1 }))).toThrow(
      "Do rozliczenia",
    );
  });
  it("przelicza saldo po edycji i usunięciu operacji", () => {
    let d = saveEntry(saveEntry(fixture(), ride()), payment());
    d = saveEntry(d, ride({ amount: 1400 }));
    expect(balance(d)).toBe(800);
    d = saveEntry(d, payment({ amount: 800 }));
    expect(balance(d)).toBe(600);
    d = {
      ...d,
      transactions: d.transactions.filter((t) => t.id !== "payment"),
    };
    expect(balance(d)).toBe(1400);
  });
  it("edycja płatności uwzględnia poprzednią kwotę i zmianę znajomego", () => {
    let d = saveEntry(saveEntry(fixture(), ride()), payment());
    d = saveEntry(d, payment({ amount: 1100 }));
    expect(balance(d)).toBe(0);
    d = {
      ...d,
      friends: [...d.friends, { id: "second", name: "Ola", rate: 500 }],
    };
    expect(() => saveEntry(d, payment({ friendId: "second" }))).toThrow();
  });
  it("prezentuje nadpłatę po usunięciu rozliczonego przejazdu osobno od należności", () => {
    let d = saveEntry(saveEntry(fixture(), ride()), payment());
    d = {
      ...d,
      transactions: d.transactions.filter((t) => t.type !== "ride"),
      friends: [...d.friends, { id: "second", name: "Ola", rate: 500 }],
    };
    d = saveEntry(
      d,
      ride({ id: "secondRide", friendId: "second", amount: 1000 }),
    );
    expect(totals(d)).toEqual({ debt: 1000, credit: 600 });
  });
  it("usunięcie znajomego usuwa wyłącznie jego wpisy i preferencję", () => {
    const d = saveEntry(fixture(), ride());
    const removed = removeFriend(d, "friend");
    expect(removed.friends).toEqual([]);
    expect(removed.transactions).toEqual([]);
    expect(removed.settings.lastFriendId).toBe(null);
  });
});
describe("Miesiące, lata i lokalne daty", () => {
  it("przypisuje koszt do przejazdu, płatność do daty rozliczenia", () => {
    const d = saveEntry(saveEntry(fixture(), ride()), payment());
    expect(monthly(d, "2026-10")).toEqual({ cost: 1100, rides: 2, paid: 0 });
    expect(monthly(d, "2026-11")).toEqual({ cost: 0, rides: 0, paid: 600 });
    expect(monthly(d, "2025-10")).toEqual({ cost: 0, rides: 0, paid: 0 });
  });
  it("obsługuje zmianę roku i lata przestępne", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(validDate("2024-02-29")).toBe(true);
    expect(validDate("2025-02-29")).toBe(false);
    expect(validDate("2026-13-01")).toBe(false);
    expect(validDate("2026-04-31")).toBe(false);
    expect(validDate("0099-01-01")).toBe(false);
  });
  it("zapisuje lokalny dzień bez konwersji UTC", () => {
    expect(today(new Date(2026, 9, 25, 0, 1))).toBe("2026-10-25");
    expect(today(new Date(2026, 9, 25, 23, 59))).toBe("2026-10-25");
  });
});
describe("Walidacja i migracje", () => {
  it("import i eksport zachowuje komplet danych", () => {
    const d = saveEntry(saveEntry(fixture(), ride()), payment());
    expect(parseBackup(JSON.stringify(d))).toEqual(d);
  });
  it("migruje schemat 1 do 2 bez utraty historii", () => {
    const d = saveEntry(fixture(), ride());
    const old = {
      ...d,
      version: 1,
      settings: { theme: "dark", defaultRate: 500 },
    };
    const result = validateData(old);
    expect(result.version).toBe(2);
    expect(result.transactions).toEqual(d.transactions);
    expect(result.settings).toEqual({
      theme: "dark",
      defaultRate: 500,
      rememberFriend: true,
      lastFriendId: null,
    });
  });
  it.each([
    null,
    {},
    { ...fixture(), version: 99 },
    { ...fixture(), transactions: [ride({ friendId: "missing" })] },
    { ...fixture(), transactions: [ride(), ride()] },
    { ...fixture(), transactions: [ride({ amount: 5.5 })] },
    { ...fixture(), transactions: [ride({ date: "2026-02-30" })] },
    { ...fixture(), friends: [{ id: "friend", name: "", rate: 500 }] },
    { ...fixture(), transactions: [payment({ amount: 0 })] },
  ])("odrzuca uszkodzony dokument %#", (input) =>
    expect(() => validateData(input)).toThrow(),
  );
  it("odrzuca niepoprawny JSON i nadmierny rozmiar", () => {
    expect(() => parseBackup("<html>")).toThrow("JSON");
    expect(() => parseBackup(" ".repeat(15_000_001))).toThrow("duży");
  });
});
describe("Atomowy zapis i ochrona danych", () => {
  it("zapis i ponowny odczyt odtwarza dane po restarcie", () => {
    const s = memory(),
      d = saveEntry(fixture(), ride());
    persistData(s, d, null);
    expect(loadData(s).data).toEqual(d);
  });
  it("nie nadpisuje uszkodzonych danych podczas startu", () => {
    const s = memory();
    s.setItem("my-friend-driver:data", "uszkodzone");
    const result = loadData(s);
    expect(result.error).toBeTruthy();
    expect(result.raw).toBe("uszkodzone");
    expect(s.getItem("my-friend-driver:data")).toBe("uszkodzone");
  });
  it("obsługuje niedostępny magazyn przy odczycie i zapisie", () => {
    const bad = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadData(bad).error).toBeTruthy();
    expect(() => persistData(bad, fixture(), null)).toThrow(
      "Nie zapisano zmiany",
    );
  });
  it("nie uznaje operacji za zapisaną po błędzie limitu", () => {
    const d = fixture();
    const raw = JSON.stringify(d);
    const full = {
      getItem: () => raw,
      setItem() {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => persistData(full, saveEntry(d, ride()), raw)).toThrow(
      "Nie zapisano zmiany",
    );
    expect(loadData(full).data.transactions).toHaveLength(0);
  });
  it("wykrywa konflikt między oknami", () => {
    const s = memory();
    persistData(s, fixture(), null);
    expect(() => persistData(s, emptyData(), null)).toThrow("innym oknie");
    expect(loadData(s).data.friends).toHaveLength(1);
  });
  it("resetuje tylko własny dokument", () => {
    const s = memory();
    s.setItem("other-app", "keep");
    const raw = persistData(s, fixture(), null);
    persistData(s, emptyData(), raw);
    expect(loadData(s).data).toEqual(emptyData());
    expect(s.getItem("other-app")).toBe("keep");
  });
});
