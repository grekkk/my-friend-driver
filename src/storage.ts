import {
  emptyData,
  parseBackup,
  STORAGE_KEY,
  validateData,
  type AppData,
} from "./model";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface LoadedData {
  data: AppData;
  raw: string | null;
  error: string | null;
}
export function loadData(storage: StorageLike): LoadedData {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    return {
      data: raw === null ? emptyData() : parseBackup(raw),
      raw,
      error: null,
    };
  } catch {
    return {
      data: emptyData(),
      raw,
      error:
        "Nie udało się odczytać zapisanych danych. Oryginał pozostaje nienaruszony. Pobierz go do odzyskania albo wczytaj poprawną kopię.",
    };
  }
}
export function persistData(
  storage: StorageLike,
  data: AppData,
  expected: string | null,
): string {
  const raw = JSON.stringify(validateData(data));
  try {
    if (storage.getItem(STORAGE_KEY) !== expected) throw new Error("conflict");
    storage.setItem(STORAGE_KEY, raw);
  } catch (error) {
    if (error instanceof Error && error.message === "conflict")
      throw new Error(
        "Dane zmieniły się w innym oknie. Odśwież aplikację przed ponownym zapisem.",
      );
    throw new Error(
      "Nie zapisano zmiany. Pamięć przeglądarki jest niedostępna lub pełna. Zwolnij miejsce albo wyeksportuj dane i spróbuj ponownie.",
    );
  }
  return raw;
}
