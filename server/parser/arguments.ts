import { StringReader } from "./string-reader";

export interface Properties {
    /**
     * The key which the node was called under
     */
    key: string;
}
export interface Arg {
    parse: (reader: StringReader, properties?: Properties) => void;
    listSuggestions: (start?: string, properties?: Properties) => string[];
}
