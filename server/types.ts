import { Interval, IntervalTree } from "node-interval-tree";
import { format } from "util";
import { CompletionItemKind, DiagnosticSeverity } from "vscode-languageserver/lib/main";
import { StringReader } from "./string-reader";

/**
 * The full path to a node from the root.
 * It is in the same format descibed for `redirect` in [Dinnerbone's gist](https://gist.github.com/Dinnerbone/7370a2846953eee2d8fc64514fb76de8)
 */
export type NodePath = string[];

/**
 * A command node. In the format of the generated tree.
 * A description of this format can be found [here](https://gist.github.com/Dinnerbone/7370a2846953eee2d8fc64514fb76de8)
 */
export interface CommandNode {
    /**
     * The type of the node.  
     * The only use of `root` is in the lowest level of the tree.  
     * An `argument` type means it's dynamically parsed, using {parser} (and any optional properties)
     */
    type: "root" | "literal" | "argument";
    /**
     * The parser to use when the type is `argument`
     */
    parser?: string;
    /**
     * The properties of a node for the parser to use.
     */
    properties?: GivenProperties;
    /**
     * Whether the command could be run from this point
     */
    executable?: boolean;
    /**
     * A redirect of the node.  
     * This is a path to act as if this node was that node in terms of children.
     */
    redirect?: NodePath;
    /**
     * The children of this node.
     */
    children?: { [key: string]: CommandNode };
}
/**
 * Further Properties of the node.  
 */
export interface GivenProperties {
    [additionals: string]: any;
}
/**
 * The properties of a node for the parser to use
 */
export interface NodeProperties extends GivenProperties {
    /**
     * The key this node was called with.  
     * This should be added by the interpreter and is not included by default.
     */
    key: string;
    /**
     * The full path to this node.  
     */
    path: NodePath;
}

/**
 * A description of an area of a node.
 */
export interface NodeRange extends Interval {
    /**
     * The name of the node in the tree.
     */
    key: string;
    /**
     * The path to the node in the command tree.
     * Used so that properties can be accessed
     */
    path?: NodePath;
    /**
     * The context of this node.  
     * A new copy is created whenever
     */
    context?: CommandContext;
}

/**
 * Information about the server.
 */
export interface ServerInformation {
    /**
     * The folder uri this server is working on.
     */
    workspaceFolder: string;
    /**
     * Information about all of the open text documents
     */
    documentsInformation: { [uri: string]: DocumentInformation };
    /**
     * The command tree
     */
    tree: CommandNode & { type: "root" };
    /**
     * The connection to the client.  
     * This is mostly to be used to allowing console logging for debugging
     */
    logger: (message: string) => void;
}

export interface DocumentInformation {
    lines: DocLine[];
    packFolderURI: string;
}
export interface DocLine {
    issue?: FunctionDiagnostic;
    nodes: NodeRange[];
    tree?: IntervalTree<NodeRange>;
    text?: string;
}

export interface FunctionDiagnostic {
    type: string;
    message: string;
    severity: DiagnosticSeverity;
    start: number;
    end: number;
}

export interface CommandContext {
    server: ServerInformation;
    executortype: "entity" | "player" | "any";
    params?: any;
}

export interface Suggestion {
    /**
     * The string to suggest.
     */
    value: string;
    /**
     * The start from where value should be replaced. 0 indexed character gaps.
     * E.g. `@e[na` with the suggestion `{value:"name=",start:3}` 
     * would make `@e[name=` when accepted.
     */
    start: number;
    /**
     * The kind of the suggestion in the Completion List
     */
    kind?: CompletionItemKind;
}

export type SuggestResult = Suggestion | string;

export interface Parser {
    /**
     * Parse the argument as described in NodeProperties against this parser in the reader.  
     * The context is optional for the literal and for tests
     */
    parse: (reader: StringReader, properties: NodeProperties, context?: CommandContext) => void;
    /**
     * List the suggestions at the end of the starting text described in `text`.
     * @returns an array of Suggestions, either strings or a Suggestion objection
     */
    getSuggestions: (text: string, properties: NodeProperties, context?: CommandContext) => SuggestResult[];
    /**
     * The kind of the suggestion in the Completion List
     */
    kind?: CompletionItemKind;
}

export interface ParseResult {
    nodes?: NodeRange[];
    issue?: FunctionDiagnostic;
}

export class CommandSyntaxException {
    private description: string;
    private type: string;
    private severity: DiagnosticSeverity;
    constructor(description: string, type: string, severity?: DiagnosticSeverity) {
        this.description = description;
        this.type = type;
        this.severity = severity || DiagnosticSeverity.Error;
    }
    public create(start: number, end: number, ...formatting: any[]): FunctionDiagnostic {
        const diagnosis: FunctionDiagnostic = { severity: this.severity } as FunctionDiagnostic;
        diagnosis.end = end;
        diagnosis.start = start;
        diagnosis.message = format(this.description, ...formatting);
        diagnosis.type = this.type;
        return diagnosis;
    }
}
