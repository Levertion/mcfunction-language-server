import deepmerge = require("deepmerge");
import fs = require("fs");
import Path = require("path");
import { sprintf } from "sprintf-js";
import Url = require("url");
import { NBTARGSEP, NBTARRPREFIX, NBTARRPREFIXSEP, NBTCOMPOUNDCLOSE, NBTCOMPOUNDOPEN, NBTKEYVALUESEP, NBTLISTARRCLOSE, NBTLISTARROPEN, NBTNUMBERSUFFIX } from "../../consts";
import { StringReader } from "../../string-reader";
import { CommandContext, CommandSyntaxException, NodeProperties, Parser } from "../../types";
import { ArrayReader } from "./nbt-util/array-reader";
import { NBTIssue } from "./nbt-util/nbt-issue";

const nbtPath = Path.resolve(__dirname, "../../node_modules/mc-nbt-paths/root.json");

const nbtRoot = JSON.parse(fs.readFileSync(Path.resolve(__dirname, nbtPath)).toString()) as NBTNode;

const endCompletableTag = /byte|short|int|long|float|double|string/;

const tryWithData = (func: () => any, data: any = {}) => {
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
    context: {
        ref_dict?: [{
            name: string,
            ref: string,
            default_val: string,
        }];
        data: CommandContext["commandInfo"]["nbtInfo"];
        replaceInfo?: boolean;
    };
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
            throw new NBTIssue(exception.invalidNbt.create(start, reader.cursor, "Expected " + NBTLISTARRCLOSE), { correctType: true, completions: [NBTLISTARRCLOSE] });
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
            err.data.path.splice(0, 0, ".");
            err.data.parsedValue = [];
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
        });
        while (reader.canRead()) {
            reader.skipWhitespace();
            const valStart = reader.cursor;
            let val;
            try {
                val = parseValue(reader);
            } catch (err) {
                err.data.path.splice(0, 0, ".");
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
            try {
                key = reader.readString(true);
            } catch (err) {
                throw new NBTIssue(exception.needKey.create(start, reader.cursor), { currKeys: keys, pos: keyStart, compoundType: "key", correctType: true });
            }
            reader.skipWhitespace();
            tryWithData(() => reader.expect(NBTKEYVALUESEP), { currKeys: keys, compoundType: "key", correctType: true, compString: key, pos: keyStart, completions: [NBTKEYVALUESEP] });
            keys.push(key);
            reader.skipWhitespace();
            if (!reader.canRead()) {
                throw new NBTIssue(exception.needValue.create(reader.cursor, reader.cursor), { compoundType: "val", compString: "", pos: reader.cursor, correctType: true, path: [key] });
            }
            let value;
            try {
                value = parseValue(reader);
            } catch (err) {
                (err.data.path as string[]).splice(0, 0, key);
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
        const out: string[] = [];
        const reader = new StringReader(text);
        try {
            parseValue(reader);
        } catch (err) {
            if (err.data !== undefined) {
                const path: any = err.data.path;
                const node = getNodeFromPath(path, context);
                if (tagSuggestions[node.type] !== undefined) {
                    out.push(...tagSuggestions[node.type](err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "", node));
                }
                if (err.data.completions !== undefined) {
                    out.push(...err.data.completions);
                }
            }
        }
        return out;
    },
};

export const getSuggestionsWithStartText = (reader: StringReader, _prop: NodeProperties, context?: CommandContext) => {
    const out: { startText?: string, comp?: string[], startPos?: number } = {};
    try {
        parseValue(reader);
    } catch (err) {
        if (err.data !== undefined) {
            const path: any = err.data.path === undefined ? [] : err.data.path;
            const node = getNodeFromPath(path, context);
            if (node === null) {
                out.comp = [];
                out.startPos = err.data.pos === undefined ? reader.cursor : err.data.pos;
                out.startText = err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "";
                return out;
            }
            if (tagSuggestions[node.type] !== undefined) {
                out.comp = tagSuggestions[node.type](err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "", node, err);
            }
            out.startText = err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "";
            if (err.data.completions !== undefined) {
                out.comp.push(...err.data.completions);
            }
            out.startPos = err.data.pos === undefined ? reader.cursor : err.data.pos;
        }
    }
    return out;
};

const tagSuggestions: { [index: string]: (text: string, node?: NBTNode, err?: NBTIssue) => string[] } = {
    byte: (text: string) => ["-256b", "0b", "1b", "255b"].filter((val) => val.startsWith(text)),
    short: (text: string) => ["-32768s", "0s", "1s", "32767s"].filter((val) => val.startsWith(text)),
    int: (text: string) => ["-2147483648", "0", "1", "2147483647"].filter((val) => val.startsWith(text)),
    long: (text: string) => ["0l", "1l"].filter((val) => val.startsWith(text)),
    float: (text: string) => ["0f", "1f"].filter((val) => val.startsWith(text)),
    double: (text: string) => ["0d", "1d"].filter((val) => val.startsWith(text)),
    compound: (text: string, node: NBTNode, err: NBTIssue) => {
        const out: string[] = [];
        if (err.data.compoundType === "key") {
            for (const s of Object.keys(node.children)) {
                if (s.startsWith(text) && !err.data.currKeys.includes(s)) {
                    out.push(s);
                }
            }
        } else if (err.data.compoundType === "val") {
            for (const s of Object.keys(node.children)) {
                if (tagSuggestions[node.children[s].type] !== undefined) {
                    out.push(...tagSuggestions[node.children[s].type](err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "", node));
                }
            }
        }
        return out;
    },
    list: (_text: string, node: NBTNode) => {
        if (node.item !== undefined) {
            return tagSuggestions[node.type]("", node.item);
        }
        return [];
    },
};

const getNodeFromPath = (path: string[], context: CommandContext) => {
    const type = context.commandInfo.nbtInfo.type;
    path.splice(0, 0, type, context.commandInfo.nbtInfo.id !== undefined ? context.commandInfo.nbtInfo.id : "none");
    const arrReader = new ArrayReader(path);
    return goToPathNode(nbtPath, nbtRoot, arrReader, context);
};

const goToPathNode = (currentPath: string, tempNode: NBTNode, arrReader: ArrayReader, tempContext?: CommandContext): NBTNode => {
    const aux1context = evalContextFormat(tempNode, tempContext);
    const node = evalRef(currentPath, arrReader, tempNode, aux1context);
    const context = evalContextFormat(node, aux1context);
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
            const out = goToPathNode(currentPath, childNode, arrReader, context);
            if (out !== null) {
                return out;
            }
        }
    } else if (node.type === "list") {
        arrReader.skip();
        if (next !== "." || node.item === undefined) {
            return null;
        }
        return goToPathNode(currentPath, node.item, arrReader, context);
    }
    return null;
};

const evalNodeWithChildRefs = (currentPath: string, node: NBTNode, context?: CommandContext) => {
    const out = JSON.parse(JSON.stringify(node)) as NBTNode;
    for (const cr of out.child_ref) {
        const refUrl = Url.parse(cr);
        const fragParts = refUrl.hash === null ? [] : refUrl.hash.slice(1).split("/");
        const crArrReader = new ArrayReader(fragParts);
        const refPath = Path.resolve(Path.parse(currentPath).dir, refUrl.path);
        const refNode = goToPathNode(refPath, JSON.parse(fs.readFileSync(refPath).toString()), crArrReader, context);
        if (refNode.children !== undefined) {
            for (const c of Object.keys(refNode.children)) {
                out.children[c] = refNode.children[c];
            }
        }
    }
    return out;
};

const evalNodeWithRef = (currentPath: string, arrReader: ArrayReader, node: NBTNode, context?: CommandContext) => {
    const refUrl = Url.parse(node.ref);
    const fragParts = refUrl.hash === null ? [] : refUrl.hash.slice(1).split("/");
    arrReader.addAtCursor(fragParts);
    const refPath = Path.resolve(Path.parse(currentPath).dir, refUrl.path);
    return goToPathNode(refPath, JSON.parse(fs.readFileSync(refPath).toString()), arrReader, context);
};

const evalRef = (currentPath: string, arrReader: ArrayReader, node: NBTNode, context?: CommandContext) => {
    if (node === null) {
        return null;
    }
    let out = node;
    if (node.ref !== undefined) {
        out = evalNodeWithRef(currentPath, arrReader, out, context);
    }
    if (node.type === "compound" || node.type === "root") {
        if (node.child_ref !== undefined) {
            out = evalNodeWithChildRefs(currentPath, out, context);
        }
    }
    return out;
};

const evalContextFormat = (node: NBTNode, context: CommandContext) => {
    if (node === null) {
        return context;
    }
    if (node.context === undefined || node.context.data === undefined) {
        return context;
    }
    const newInfo = node.context;
    const newContext = Object.assign({}, context);
    if (newInfo.replaceInfo !== undefined && newInfo.replaceInfo) {
        return Object.assign(newContext, mapFinalNode(newInfo.data, (n: any) => typeof n === "string" ? sprintf(n, newInfo.ref_dict) : n));
    }
    return deepmerge(newContext, mapFinalNode(newInfo.data, (n: any) => typeof n === "string" ? sprintf(n, newInfo.ref_dict) : n));
};

function mapFinalNode(obj: any, callback: (n: object) => any) {
    const out: any = {};
    for (const o of Object.keys(obj)) {
        if (typeof obj[o] === "object" && obj[o] !== null) {
            out[o] = mapFinalNode(obj[o], callback);
        } else {
            out[o] = callback(obj[o]);
        }
    }
    return out;
}
