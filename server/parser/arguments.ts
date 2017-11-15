import { StringReader } from "./string-reader";


export interface Properties {
    /**
     * The key which the node was called under
     */
    key: string
}

export abstract class Argument {
    static parse: (reader: StringReader, properties?: Properties) => void;
    static listSuggestions: (start?: string, properties?: Properties) => string[];
}
