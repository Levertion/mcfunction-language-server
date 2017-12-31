// https://stackoverflow.com/a/43523944

declare module NodeJS {
    interface Global {
        mcfunctionLog: (message: string) => void;
    }
}

// Used to allow logging without passing info to files which don't need it.
declare const mcfunctionLog: (message: string) => void;
