declare module "embedded-postgres" {
  interface EmbeddedPostgresOptions {
    user: string;
    password: string;
    port: number;
    persistent: boolean;
    databaseDir: string;
    initdbFlags: string[];
  }

  export default class EmbeddedPostgres {
    constructor(options: EmbeddedPostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    createDatabase(name: string): Promise<void>;
    stop(): Promise<void>;
  }
}
