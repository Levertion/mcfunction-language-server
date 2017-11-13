import { StringReader } from "../string-reader";

export interface Argument {
    parse: (reader: StringReader) => void;
}
