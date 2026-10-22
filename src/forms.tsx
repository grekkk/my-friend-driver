import { useState, type FormEvent } from "react";
import {
  balance,
  id,
  MAX_MONEY,
  money,
  moneyInput,
  parseMoney,
  saveEntry,
  today,
  validDate,
  validateData,
  type AppData,
  type Friend,
  type Transaction,
} from "./model";
import { errorMessage, Icon } from "./components";

export type Commit = (
  update: (data: AppData) => AppData,
  recovery?: boolean,
) => void;
export function FriendForm({
  data,
  friend,
  commit,
  done,
}: {
  data: AppData;
  friend?: Friend;
  commit: Commit;
  done: (message: string) => void;
}) {
  const [name, setName] = useState(friend?.name ?? "");
  const [rate, setRate] = useState(
    moneyInput(friend?.rate ?? data.settings.defaultRate),
  );
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (!name.trim()) throw new Error("Wpisz imię lub nazwę znajomego.");
      const next: Friend = {
        id: friend?.id ?? id(),
        name: name.trim(),
        rate: parseMoney(rate),
      };
      commit((d) =>
        validateData({
          ...d,
          friends: friend
            ? d.friends.map((f) => (f.id === friend.id ? next : f))
            : [...d.friends, next],
          settings: { ...d.settings, lastFriendId: next.id },
        }),
      );
      done(friend ? "Zapisano zmiany znajomego" : "Dodano znajomego");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <form onSubmit={submit} className="form">
      <label>
        Imię lub nazwa
        <input
          autoComplete="off"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Kuba"
          required
        />
      </label>
      <label>
        Stawka za przejazd
        <div className="input-unit">
          <input
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
            aria-label="Stawka za przejazd"
          />
          <span>zł</span>
        </div>
      </label>
      <p className="field-note">
        Stawka uzupełni się przy dodawaniu przejazdu. Możesz ją wtedy zmienić.
      </p>
      {friend && (
        <p className="field-note">
          Zmiana stawki nie zmienia zapisanych przejazdów.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary wide" type="submit">
        {friend ? "Zapisz zmiany" : "Dodaj znajomego"}
      </button>
    </form>
  );
}

export function EntryForm({
  data,
  type,
  entry,
  friendId,
  commit,
  done,
}: {
  data: AppData;
  type: "ride" | "payment";
  entry?: Transaction;
  friendId?: string;
  commit: Commit;
  done: (message: string) => void;
}) {
  const initialFriend =
    entry?.friendId ??
    friendId ??
    (data.settings.rememberFriend ? data.settings.lastFriendId : null) ??
    data.friends[0]?.id ??
    "";
  const [selectedFriend, setFriend] = useState(initialFriend);
  const [date, setDate] = useState(entry?.date ?? today());
  const [quantity, setQuantity] = useState(
    entry?.type === "ride" ? String(entry.quantity) : "1",
  );
  const [rate, setRate] = useState(
    moneyInput(
      entry?.type === "ride"
        ? entry.rate
        : (data.friends.find((f) => f.id === initialFriend)?.rate ??
            data.settings.defaultRate),
    ),
  );
  const [customCost, setCustomCost] = useState(
    entry?.type === "ride" && entry.amount !== entry.quantity * entry.rate,
  );
  const [amount, setAmount] = useState(entry ? moneyInput(entry.amount) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [showNote, setShowNote] = useState(!!entry?.note);
  const [error, setError] = useState("");
  const payment = type === "payment";
  const without = {
    ...data,
    transactions: data.transactions.filter((t) => t.id !== entry?.id),
  };
  const owing = Math.max(0, balance(without, selectedFriend));
  let computed = 0;
  try {
    computed = parseMoney(rate) * Number(quantity);
  } catch {
    /* Invalid input is explained on submit. */
  }
  const selected = data.friends.find((f) => f.id === selectedFriend);
  function changeFriend(value: string) {
    setFriend(value);
    if (!entry && !payment)
      setRate(
        moneyInput(
          data.friends.find((f) => f.id === value)?.rate ??
            data.settings.defaultRate,
        ),
      );
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (!selected) throw new Error("Wybierz znajomego.");
      if (!validDate(date))
        throw new Error("Wybierz poprawną datę (od 1900 roku).");
      const count = Number(quantity);
      if (!payment && (!Number.isInteger(count) || count < 1 || count > 999))
        throw new Error("Liczba przejazdów musi wynosić od 1 do 999.");
      const cost =
        payment || customCost ? parseMoney(amount) : parseMoney(rate) * count;
      if (cost > MAX_MONEY) throw new Error("Łączny koszt jest zbyt duży.");
      if (payment && cost <= 0)
        throw new Error("Kwota płatności musi być większa od zera.");
      const base = {
        id: entry?.id ?? id(),
        friendId: selectedFriend,
        date,
        amount: cost,
        note: note.trim(),
        createdAt: entry?.createdAt ?? new Date().toISOString(),
      };
      const next: Transaction = payment
        ? { ...base, type: "payment" }
        : { ...base, type: "ride", quantity: count, rate: parseMoney(rate) };
      commit((d) => saveEntry(d, next));
      done(
        entry
          ? "Zapisano zmiany wpisu"
          : payment
            ? "Zapisano płatność"
            : "Dodano przejazd",
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <div className="form-group">
        <label className="inline-field">
          Znajomy
          <select
            value={selectedFriend}
            onChange={(e) => changeFriend(e.target.value)}
            aria-label="Znajomy"
          >
            {data.friends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          Data
          <input
            type="date"
            min="1900-01-01"
            max="9999-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            aria-label="Data"
          />
        </label>
      </div>
      {payment ? (
        <>
          <div className="payment-owing">
            <span>Do rozliczenia z {selected?.name}</span>
            <strong>{money(owing)}</strong>
          </div>
          <label>
            Kwota płatności
            <div className="input-unit large-input">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0,00"
                aria-label="Kwota płatności"
              />
              <span>zł</span>
            </div>
          </label>
          <button
            type="button"
            className="settle link"
            disabled={owing === 0}
            onClick={() => setAmount(moneyInput(owing))}
          >
            Rozlicz całość <Icon name="arrow" size={14} />
          </button>
          {owing === 0 && (
            <p className="field-note">
              Wszystko rozliczone. Płatność dodasz po zapisaniu kolejnego
              przejazdu.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="form-group">
            <div className="inline-field">
              <label htmlFor="ride-count">Liczba przejazdów</label>
              <div className="stepper">
                <button
                  type="button"
                  aria-label="Mniej przejazdów"
                  disabled={Number(quantity) <= 1}
                  onClick={() =>
                    setQuantity(String(Math.max(1, Number(quantity) - 1)))
                  }
                >
                  <Icon name="minus" size={18} />
                </button>
                <input
                  id="ride-count"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
                <button
                  type="button"
                  aria-label="Więcej przejazdów"
                  disabled={Number(quantity) >= 999}
                  onClick={() =>
                    setQuantity(String(Math.min(999, Number(quantity) + 1)))
                  }
                >
                  <Icon name="plus" size={18} />
                </button>
              </div>
            </div>
            <label className="inline-field">
              Stawka
              <div className="input-unit compact">
                <input
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  required
                  aria-label="Stawka"
                />
                <span>zł</span>
              </div>
            </label>
          </div>
          <div className="cost-summary">
            <div>
              <span>Łączny koszt</span>
              <strong>
                {Number.isSafeInteger(computed) &&
                computed <= MAX_MONEY &&
                computed >= 0
                  ? money(computed)
                  : "—"}
              </strong>
            </div>
            <p>
              {quantity || "0"} × {rate || "0"} zł
            </p>
          </div>
          <label className="switch-row">
            <span>Własny koszt przejazdu</span>
            <input
              type="checkbox"
              role="switch"
              checked={customCost}
              onChange={(e) => {
                setCustomCost(e.target.checked);
                if (
                  e.target.checked &&
                  !amount &&
                  computed >= 0 &&
                  computed <= MAX_MONEY
                )
                  setAmount(moneyInput(computed));
              }}
            />
            <span className="switch-track" aria-hidden="true" />
          </label>
          {customCost && (
            <label>
              Łączny koszt po zmianie
              <div className="input-unit">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  aria-label="Łączny koszt po zmianie"
                />
                <span>zł</span>
              </div>
            </label>
          )}
        </>
      )}
      {showNote ? (
        <label>
          Notatka <span className="muted">(opcjonalnie)</span>
          <textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="np. Powrót ze szkoły"
          />
        </label>
      ) : (
        <button
          type="button"
          className="text-button note-button"
          onClick={() => setShowNote(true)}
        >
          <Icon name="plus" size={17} /> Dodaj notatkę
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary wide" type="submit">
        {entry
          ? "Zapisz zmiany"
          : payment
            ? "Zapisz płatność"
            : "Dodaj przejazd"}
      </button>
    </form>
  );
}

export function DefaultRateForm({
  data,
  commit,
  done,
}: {
  data: AppData;
  commit: Commit;
  done: (message: string) => void;
}) {
  const [rate, setRate] = useState(moneyInput(data.settings.defaultRate));
  const [error, setError] = useState("");
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const value = parseMoney(rate);
          commit((d) => ({
            ...d,
            settings: { ...d.settings, defaultRate: value },
          }));
          done("Zapisano domyślną stawkę");
        } catch (e) {
          setError(errorMessage(e));
        }
      }}
    >
      <label>
        Stawka dla nowych znajomych
        <div className="input-unit">
          <input
            inputMode="decimal"
            aria-label="Domyślna stawka"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <span>zł</span>
        </div>
      </label>
      <p className="field-note">
        Podpowiemy tę kwotę, gdy dodasz znajomego. Stawki obecnych znajomych
        pozostaną bez zmian.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="primary wide" type="submit">
        Zapisz stawkę
      </button>
    </form>
  );
}
