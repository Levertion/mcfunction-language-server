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

export abstract class Argument {
    public static parse: (reader: StringReader, properties?: Properties) => void;
    public static listSuggestions: (start?: string, properties?: Properties) => string[];
}
