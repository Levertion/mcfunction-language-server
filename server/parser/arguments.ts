import { StringReader } from "./string-reader";

export interface Argument {
    create: (options: object) => Argument
    parse: (reader: StringReader) => void;
    listSuggestions: (start: string) => string[];
}
