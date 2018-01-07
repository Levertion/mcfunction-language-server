// https://stackoverflow.com/a/43523944

declare module NodeJS {
    interface Global {
        mcfunctionLog: (message: string) => void;
        mcfunctionSettings: McfunctionSettings;
    }
}

/**
 * Log to the remote console.
 */
declare const mcfunctionLog: (message: string) => void;
/**
 * The settings of this server
 */
declare const mcfunctionSettings: McfunctionSettings;

declare interface McfunctionSettings {
    dataobtainer: {
        snapshots: boolean,
        javapath: string,
    }
}
