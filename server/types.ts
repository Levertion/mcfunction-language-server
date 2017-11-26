import { Interval, IntervalTree } from "node-interval-tree";
import { format } from "util";
import { Diagnostic, DiagnosticSeverity, IConnection } from "vscode-languageserver/lib/main";
import { StringReader } from "./brigadier-implementations";

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
    properties?: NodeProperties;
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
 * The properties of a node for the parser to use
 */
export interface NodeProperties {
    /**
     * The key this node was called with.  
     * This should be added by the interpreter and is not included by default.
     */
    key: string;
    /**
     * The full path to this node.  
     */
    path: NodePath;
    /**
     * Further Properties of the node.  
     */
    [additionals: string]: any;
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
     * TODO: Actually implement this.
     */
    path?: string[];
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
    connection: IConnection;
}

export interface DocumentInformation {
    lines: DocLine[];
}
export interface DocLine {
    issue?: FunctionDiagnostic;
    Nodes: IntervalTree<NodeRange>;
}

export interface FunctionDiagnostic {
    type: string;
    message: string;
    severity: DiagnosticSeverity;
    start: number;
    end: number;
}

export function toDiagnostic(diagnosis: FunctionDiagnostic, line: number): Diagnostic {
    return Diagnostic.create({
        start: { line, character: diagnosis.start },
        end: { line, character: diagnosis.end },
    }, diagnosis.message, diagnosis.severity, diagnosis.type, "mcfunction");
}

export interface Parser {
    parse: (reader: StringReader, properties: NodeProperties, serverInfo?: ServerInformation) => void;
    getSuggestions: (text: string, properties: NodeProperties, serverInfo?: ServerInformation) => string[];
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
    public create(start: number, end: number | StringReader, ...formatting: any[]): FunctionDiagnostic {
        const diagnosis: FunctionDiagnostic = { severity: this.severity } as FunctionDiagnostic;
        if (end instanceof StringReader) {
            diagnosis.end = end.string.length;
        } else {
            diagnosis.end = end;
        }
        diagnosis.start = start;
        diagnosis.message = format(this.description, ...formatting);
        diagnosis.type = this.type;
        return diagnosis;
    }
}
