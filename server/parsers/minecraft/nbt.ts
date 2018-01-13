import fs = require("fs");
import Path = require("path");
import { sprintf } from "sprintf-js";
import Url = require("url");
import { CompletionItemKind } from "vscode-languageserver/lib/main";
import { NBTARGSEP, NBTARRPREFIX, NBTARRPREFIXSEP, NBTCOMPOUNDCLOSE, NBTCOMPOUNDOPEN, NBTKEYVALUESEP, NBTLISTARRCLOSE, NBTLISTARROPEN, NBTNUMBERSUFFIX } from "../../consts";
import { StringReader } from "../../string-reader";
import { CommandContext, CommandSyntaxException, NodeProperties, Parser, Suggestion } from "../../types";
import { ArrayReader } from "./nbt-util/array-reader";
import { NBTIssue, NBTIssueData } from "./nbt-util/nbt-issue";

const nbtPath = Path.resolve(__dirname, "../../node_modules/mc-nbt-paths/root.json");

const nbtRoot = JSON.parse(fs.readFileSync(Path.resolve(__dirname, nbtPath)).toString()) as NBTNode;
nbtRoot.realPath = nbtPath;

const endCompletableTag = /byte|short|int|long|float|double|string/;

const tryWithData = (func: () => any, data: NBTIssueData = {}) => {
    try {
        func();
    } catch (err) {
        throw new NBTIssue(err, data);
    }
};

interface NBTNode {
    type?: "byte" | "short" | "int" | "long" | "float" | "double" | "byte_array" | "string" | "list" | "compound" | "int_array" | "long_array" | "root";
    children?: {
        [key: string]: NBTNode;
    };
    child_ref?: string[];
    item?: NBTNode;
    ref?: string;
    context?: {
        ref_dict: [{
            name: string,
            nbt_ref: string,
        }],
        ref: string,
        default: string,
    };
    realPath?: string;
}

const exception = {
    trailingData: new CommandSyntaxException("Unexpected trailing data", "argument.nbt.trailing"),
    needKey: new CommandSyntaxException("Extected key", "argument.nbt.expected.key"),
    needValue: new CommandSyntaxException("Extected value", "argument.nbt.expected.value"),
    mixedList: new CommandSyntaxException("Can't insert %s into list of %s", "argument.nbt.list.mixed"),
    mixedArray: new CommandSyntaxException("Can't insert %s into %s", "argument.nbt.array.mixed"),
    invalidArray: new CommandSyntaxException("Invalid array type '%s'", "argument.nbt.array.invalid"),
    badChar: new CommandSyntaxException("Expected character '%s', but got '%s'", "argument.nbt.badchar"),
    invalidNbt: new CommandSyntaxException("Invalid NBT: %s", "argument.nbt.invalid"),
};

const getTypeForNumberType: { [key: string]: string } = {
    "b": "byte",
    "s": "short",
    "": "int",
    "l": "long",
    "f": "float",
    "d": "double",
    "B": "byte_array",
    "I": "int_array",
    "L": "long_array",
};

const valueParsers = {
    tagWholeNum: (reader: StringReader, suf: string): ParserReturn => {
        const start = reader.cursor;
        let out;
        try {
            out = reader.readScientific();
        } catch (e) {
            reader.cursor = start;
            tryWithData(() => out = reader.readInt());
        }
        if (suf !== undefined) {
            tryWithData(() => reader.expect(suf));
        }
        return { text: reader.string.slice(start, reader.cursor), value: out, type: getTypeForNumberType[suf] };
    },
    tagFloatNum: (reader: StringReader, suf: string): ParserReturn => {
        const start = reader.cursor;
        let out;
        try {
            out = reader.readScientific();
        } catch (e) {
            reader.cursor = start;
            tryWithData(() => out = reader.readFloat(), {});
        }
        if (suf !== undefined) {
            tryWithData(() => reader.expect(suf), {});
        }
        return { text: reader.string.slice(start, reader.cursor), value: out, type: getTypeForNumberType[suf] };
    },
    tagString: (reader: StringReader): ParserReturn => {
        const start = reader.cursor;
        let out;
        tryWithData(() => out = reader.readString(true));
        return { text: reader.string.slice(start, reader.cursor), value: out, type: "string" };
    },
    tagWholeNumArray: (reader: StringReader, pre: string): ParserReturn => {
        const out: number[] = [];
        const start = reader.cursor;
        tryWithData(() => reader.expect(NBTLISTARROPEN));
        if (!reader.canRead()) {
            throw new NBTIssue(exception.invalidNbt.create(start, reader.cursor, "Expected " + NBTLISTARRCLOSE));
        }
        if (!(reader.peek() === pre && reader.peek(1) === NBTARRPREFIXSEP)) {
            throw new NBTIssue(exception.invalidArray.create(start, reader.cursor, reader.peek()));
        }
        reader.skip(); reader.skip();
        let next: string = "";
        while (next !== NBTLISTARRCLOSE) {
            reader.skipWhitespace();
            const num = valueParsers.tagWholeNum(reader, undefined);
            out.push(num.value);
            reader.skipWhitespace();
            next = reader.read();
        }
        return { text: reader.string.slice(start, reader.cursor), value: out, type: getTypeForNumberType[pre] };
    },
    tagList: (reader: StringReader): ParserReturn => {
        const out: any[] = [];
        const start = reader.cursor;
        tryWithData(() => reader.expect(NBTLISTARROPEN));
        if (!reader.canRead()) {
            throw new NBTIssue(exception.invalidNbt.create(start, reader.cursor, "Expected " + NBTLISTARRCLOSE), { noVal: true, correctType: true, completions: [NBTLISTARRCLOSE] });
        }
        reader.skipWhitespace();
        if (reader.peek() === NBTLISTARRCLOSE) {
            reader.skip();
            return { text: NBTLISTARROPEN + NBTLISTARRCLOSE, value: [], type: "list" };
        }
        let listType;
        try {
            listType = parseValue(reader);
        } catch (err) {
            err.data.path.splice(0, 0, out.length);
            err.data.parsedValue = [JSON.parse(JSON.stringify(err.data.parsedValue))];
            throw err;
        }
        out.push(listType.value);
        reader.skipWhitespace();
        if (reader.peek() === NBTLISTARRCLOSE) {
            reader.skip();
            return { text: reader.string.slice(start, reader.cursor), value: out, type: "list" };
        }
        tryWithData(() => reader.expect(NBTARGSEP), {
            correctType: true,
            compString: endCompletableTag.test(listType.type) ? listType.text : undefined,
            completions: [",", "]"],
        });
        while (reader.canRead()) {
            reader.skipWhitespace();
            const valStart = reader.cursor;
            let val;
            if (!reader.canRead()) {
                throw new NBTIssue(exception.invalidNbt.create(start, reader.cursor, "Expected Value"), { noVal: true, correctType: true });
            }
            try {
                val = parseValue(reader);
            } catch (err) {
                err.data.path.splice(0, 0, out.length);
                out.push(JSON.parse(JSON.stringify(err.data.parsedValue)));
                err.data.parsedValue = out;
                throw err;
            }
            out.push(val.value);
            if (val.type !== listType.type) {
                throw new NBTIssue(exception.mixedList.create(valStart, reader.cursor, reader.string.charAt(valStart)), { correctType: true });
            }
            reader.skipWhitespace();
            if (reader.peek() === NBTLISTARRCLOSE) {
                break;
            }
            tryWithData(() => reader.expect(NBTARGSEP), {
                correctType: true,
                compString: endCompletableTag.test(val.type) ? val.text : undefined,
                completions: [",", "]"],
            });
        }
        reader.skip();
        return { text: reader.string.slice(start, reader.cursor), value: out, type: "list" };
    },
    tagCompound: (reader: StringReader): ParserReturn => {
        const out: { [key: string]: any } = {};
        const keys = [];
        const start = reader.cursor;
        tryWithData(() => reader.expect(NBTCOMPOUNDOPEN));
        if (!reader.canRead()) {
            throw new NBTIssue(exception.invalidNbt.create(start, reader.cursor, "Expected }"), { pos: reader.cursor + 1, currKeys: [], compoundType: "key", correctType: true, completions: [NBTCOMPOUNDCLOSE] });
        }
        let next = reader.peek();
        while (next !== NBTCOMPOUNDCLOSE) {
            reader.skipWhitespace();
            const keyStart = reader.cursor;
            let key;
            if (!reader.canRead()) {
                throw new NBTIssue(exception.needKey.create(start, reader.cursor), { parsedValue: out, currKeys: keys, pos: keyStart, compoundType: "key", correctType: true });
            }
            try {
                key = reader.readString(true);
            } catch (err) {
                throw new NBTIssue(exception.needKey.create(start, reader.cursor), { parsedValue: out, currKeys: keys, pos: keyStart, compoundType: "key", correctType: true });
            }
            reader.skipWhitespace();
            tryWithData(() => reader.expect(NBTKEYVALUESEP), { parsedValue: out, currKeys: keys, compoundType: "key", correctType: true, compString: key, pos: keyStart, completions: [NBTKEYVALUESEP] });
            keys.push(key);
            reader.skipWhitespace();
            if (!reader.canRead()) {
                throw new NBTIssue(exception.needValue.create(reader.cursor, reader.cursor), { noVal: true, parsedValue: out, compoundType: "val", compString: "", pos: reader.cursor, correctType: true, path: [key] });
            }
            let value;
            try {
                value = parseValue(reader);
            } catch (err) {
                (err.data.path as string[]).splice(0, 0, key);
                out[key] = JSON.parse(JSON.stringify(err.data.parsedValue));
                err.data.parsedValue = out;
                throw err;
            }
            out[key] = value.value;
            reader.skipWhitespace();
            next = reader.peek();
            if (next !== NBTCOMPOUNDCLOSE) {
                tryWithData(() => reader.expect(NBTARGSEP), {
                    compoundType: "val",
                    correctType: true,
                    pos: reader.cursor,
                    compString: endCompletableTag.test(value.type) ? value.text : undefined,
                    parsedValue: out,
                });
                reader.skipWhitespace();
            }
        }
        reader.skip();
        return { text: reader.string.slice(start, reader.cursor), value: out, type: "compound" };
    },
};

const parserFunc: [(reader: StringReader) => ParserReturn] = [
    (reader: StringReader) => valueParsers.tagWholeNum(reader, NBTNUMBERSUFFIX.BYTE),       // byte
    (reader: StringReader) => valueParsers.tagWholeNum(reader, NBTNUMBERSUFFIX.SHORT),      // short
    (reader: StringReader) => valueParsers.tagWholeNum(reader, NBTNUMBERSUFFIX.LONG),       // long
    (reader: StringReader) => valueParsers.tagFloatNum(reader, NBTNUMBERSUFFIX.FLOAT),      // float
    (reader: StringReader) => valueParsers.tagFloatNum(reader, NBTNUMBERSUFFIX.DOUBLE),     // double
    (reader: StringReader) => valueParsers.tagWholeNum(reader, ""),                         // int
    (reader: StringReader) => valueParsers.tagCompound(reader),                             // compound
    (reader: StringReader) => valueParsers.tagWholeNumArray(reader, NBTARRPREFIX.BYTE_ARR), // byte array
    (reader: StringReader) => valueParsers.tagWholeNumArray(reader, NBTARRPREFIX.INT_ARR),  // int array
    (reader: StringReader) => valueParsers.tagWholeNumArray(reader, NBTARRPREFIX.LONG_ARR), // long array
    (reader: StringReader) => valueParsers.tagList(reader),                                 // list
    (reader: StringReader) => valueParsers.tagString(reader),                               // string
];

interface ParserReturn {
    type: string;
    text: string;
    value: any;
}

export const parseValue = (reader: StringReader): ParserReturn => {
    let lastErr: NBTIssue;
    for (const e of parserFunc) {
        const start = reader.cursor;
        try {
            return e(reader);
        } catch (err) {
            reader.cursor = start;
            if (!(lastErr !== undefined && lastErr.data !== undefined && lastErr.data.correctType !== undefined && lastErr.data.correctType)) {
                lastErr = err;
            }
        }
    }
    throw lastErr;
};

export const parser: Parser = {
    parse: (reader: StringReader, _prop: NodeProperties, _context?: CommandContext) => {
        try {
            return valueParsers.tagCompound(reader);
        } catch (err) {
            throw (err as NBTIssue).err;
        }
    },

    getSuggestions: (text: string, _prop: NodeProperties, context?: CommandContext) => {
        if (context === undefined) {
            return [""];
        }
        const out: Suggestion[] = [];
        const reader = new StringReader(text);
        try {
            parseValue(reader);
        } catch (err) {
            if (err.data !== undefined) {
                const path: any = err.data.path;
                const node = new NBTDocWalker(err.data.parsedValue, path, context).getNodeFromPath();
                if (tagSuggestions[node.type] !== undefined) {
                    const funcOut = tagSuggestions[node.type](err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "", node, err, context);
                    out.push(...funcOut.map((v): Suggestion => ({
                        kind: CompletionItemKind.Value,
                        start: err.data.pos === undefined ? reader.cursor : err.data.pos,
                        value: v,
                    })));
                }
                if (err.data.completions !== undefined) {
                    out.push(...(err as NBTIssue).data.completions.map((v): Suggestion => ({
                        kind: CompletionItemKind.Value,
                        start: err.data.pos === undefined ? reader.cursor : err.data.pos,
                        value: v,
                    })));
                }
            }
        }
        return out;
    },
};

const tagSuggestions: { [index: string]: (text: string, node: NBTNode, err: NBTIssue, context: CommandContext) => string[] } = {
    byte: (text: string) => ["-256b", "0b", "1b", "255b"].filter((val) => val.startsWith(text)),
    short: (text: string) => ["-32768s", "0s", "1s", "32767s"].filter((val) => val.startsWith(text)),
    int: (text) => ["-2147483648", "0", "1", "2147483647"].filter((val) => val.startsWith(text)),
    long: (text) => ["0l", "1l"].filter((val) => val.startsWith(text)),
    float: (text) => ["0f", "1f"].filter((val) => val.startsWith(text)),
    double: (text) => ["0d", "1d"].filter((val) => val.startsWith(text)),
    compound: (text, node, err) => {
        const out: string[] = [];
        if (err.data.noVal) {
            return ["{"];
        } else if (err.data.compoundType === "key") {
            for (const s of Object.keys(node.children)) {
                if (s.startsWith(text) && !err.data.currKeys.includes(s)) {
                    out.push(s);
                }
            }
        }
        return out;
    },
    list: (_text, node, err, context) => {
        if (err.data.noVal) {
            return ["["];
        } else if (node.item !== undefined) {
            node.item.realPath = node.realPath;
            const newItem = new NBTDocWalker(err.data.parsedValue, [], context)
                .goToPathNode(node.item, new ArrayReader([]));
            return tagSuggestions[newItem.type]("", newItem, err, context);
        }
        return [];
    },
};

class NBTDocWalker {
    private parsedValue: any;
    private objPath: string[];
    private context: CommandContext;

    constructor(parsedValue: any, path: string[], context: CommandContext) {
        this.parsedValue = parsedValue;
        this.objPath = path;
        this.context = context;
    }

    public getNodeFromPath() {
        const nbtDocPath = [
            this.context.commandInfo.nbtInfo.type,
            this.context.commandInfo.nbtInfo.id !== undefined ? this.context.commandInfo.nbtInfo.id : "none",
        ].concat(this.objPath);
        return this.goToPathNode(nbtRoot, new ArrayReader(nbtDocPath));
    }
    public goToPathNode(unevalNode: NBTNode, arrReader: ArrayReader): NBTNode {
        const currentPath = unevalNode.realPath;
        const node = this.evalRefs(unevalNode, arrReader);
        if (arrReader.done() || node === null) {
            return node;
        }
        const next = arrReader.peek();
        if (node.type === "compound" || node.type === "root") {
            arrReader.skip();
            if (node.children !== undefined) {
                let childNode = node.children[next];
                if (childNode === undefined) {
                    Object.keys(node.children).forEach((c) => {
                        if (c.startsWith("$")) {
                            const path = c.slice(1);
                            const refUrl = Url.parse(path);
                            const group: string[] = JSON.parse(fs.readFileSync(Path.resolve(Path.parse(currentPath).dir, refUrl.path)).toString());
                            for (const s of group) {
                                if (s === next) {
                                    childNode = node.children[c];
                                }
                            }
                        }
                    });
                }
                if (childNode === undefined) {
                    return null;
                }
                childNode.realPath = childNode.realPath !== undefined ? childNode.realPath : currentPath;
                const out = this.goToPathNode(childNode, arrReader);
                if (out !== null) {
                    return out;
                }
            }
        } else if (node.type === "list") {
            arrReader.skip();
            if (node.item === undefined) {
                return null;
            }
            node.item.realPath = currentPath;
            const out = this.goToPathNode(node.item, arrReader);
            return out;
        }
        return null;
    }
    public evalNodeWithChildRefs(node: NBTNode) {
        const out = JSON.parse(JSON.stringify(node)) as NBTNode;
        for (const cr of out.child_ref) {
            const refUrl = Url.parse(cr);
            const fragParts = refUrl.hash === null ? [] : refUrl.hash.slice(1).split("/");
            const crArrReader = new ArrayReader(fragParts);
            const refPath = Path.resolve(Path.parse(node.realPath).dir, refUrl.path);
            const newNode = JSON.parse(fs.readFileSync(refPath).toString()) as NBTNode;
            newNode.realPath = refPath;
            const refNode = this.goToPathNode(newNode, crArrReader);
            if (refNode.children !== undefined) {
                for (const c of Object.keys(refNode.children)) {
                    refNode.children[c].realPath = refPath;
                    out.children[c] = refNode.children[c];
                }
            }
        }
        return out;
    }

    public evalNodeWithRef(node: NBTNode, arrReader: ArrayReader) {
        const refUrl = Url.parse(node.ref);
        const fragParts = refUrl.hash === null ? [] : refUrl.hash.slice(1).split("/").filter((v) => v !== "");
        arrReader.addAtCursor(fragParts);
        const refPath = Path.resolve(Path.parse(node.realPath).dir, refUrl.path);
        const newNode = JSON.parse(fs.readFileSync(refPath).toString()) as NBTNode;
        newNode.realPath = refPath;
        return this.goToPathNode(newNode, arrReader);
    }

    public evalRefs(node: NBTNode, arrReader: ArrayReader) {
        if (node === null) {
            return null;
        }
        let out = node;
        if (node.ref !== undefined) {
            out = this.evalNodeWithRef(node, arrReader);
        } else if (node.context !== undefined) {
            out = this.evalContextRef(node, arrReader);
        }
        if (node.type === "compound" || node.type === "root") {
            if (node.child_ref !== undefined) {
                out = this.evalNodeWithChildRefs(out);
            }
        }
        return out;
    }

    public evalContextRef(node: NBTNode, arrReader: ArrayReader) {
        if (node.context.ref_dict === undefined || node.context.ref === undefined) {
            return node;
        }
        const newRefDict: { [key: string]: string } = {};
        let valUndefined = false;
        for (const o of node.context.ref_dict) {
            const resPath = Path.posix.resolve(Path.posix.parse("/" + arrReader.getRead().slice(2).join("/")).dir + "/", o.nbt_ref);
            const val = getValFromParsedValue(this.parsedValue, resPath.split("/").slice(1));
            newRefDict[o.name] = val;
            if (val === undefined) {
                valUndefined = true;
            }
        }
        const newNode = JSON.parse(JSON.stringify(node)) as NBTNode;
        if (valUndefined && node.context.default === undefined) {
            return node;
        }
        newNode.ref = valUndefined ? node.context.default : sprintf(node.context.ref, newRefDict);
        return this.evalNodeWithRef(newNode, arrReader);
    }
}

const getValFromParsedValue = (parsedValue: any, path: string[]): string => {
    let lastObj = parsedValue;
    for (const c of path) {
        if (lastObj instanceof Object) {
            if (lastObj[c] === undefined) {
                return undefined;
            }
            lastObj = lastObj[c];
        } else if (lastObj instanceof Array) {
            lastObj = lastObj[parseInt(c, 10)];
        } else {
            return undefined;
        }
    }
    return lastObj.toString();
};

const mapFinalNode = (obj: any, callback: (n: object) => any) => {
    const out: any = {};
    for (const o of Object.keys(obj)) {
        if (typeof obj[o] === "object" && obj[o] !== null) {
            out[o] = mapFinalNode(obj[o], callback);
        } else {
            out[o] = callback(obj[o]);
        }
    }
    return out;
};
