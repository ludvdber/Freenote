/**
 * Minimal ambient types for the pinned deep import `sql.js/dist/sql-wasm.js` (the non-browser build
 * that honours `locateFile`, paired with `sql-wasm.wasm`). We only type the tiny surface used by the
 * Anki `.apkg` reader — see components/tools/flashcards/apkg.ts.
 */
declare module 'sql.js/dist/sql-wasm.js' {
  interface QueryResult {
    columns: string[];
    values: unknown[][];
  }
  interface SqlJsDatabase {
    exec(sql: string): QueryResult[];
    close(): void;
  }
  interface SqlJsStatic {
    Database: new (data?: Uint8Array | null) => SqlJsDatabase;
  }
  interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
  }
  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;
}
