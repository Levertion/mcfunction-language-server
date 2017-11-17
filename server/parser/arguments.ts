import { Interval } from "node-interval-tree";
import { StringReader } from "./string-reader";

/**
 * A description of an area of a node.
 * The only additional property is the key, which is its name
 */
export interface NodeRange extends Interval {
    key: string;
}

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
