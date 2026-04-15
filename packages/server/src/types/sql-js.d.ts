declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string, params?: unknown[]): Array<{
      columns: string[];
      values: unknown[][];
    }>;
    prepare(sql: string, params?: unknown[]): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    get(params?: unknown[]): unknown[] | null;
    getAsObject(params?: unknown[]): Record<string, unknown>;
    getColumnNames(): string[];
    free(): void;
    reset(): boolean;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export type { Database, Statement };
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
