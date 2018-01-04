import fs = require("fs");
import Path = require("path");
import Url = require("url");
import { NBTARGSEP, NBTARRPREFIX, NBTARRPREFIXSEP, NBTCOMPOUNDCLOSE, NBTCOMPOUNDOPEN, NBTKEYVALUESEP, NBTLISTARRCLOSE, NBTLISTARROPEN, NBTNUMBERSUFFIX } from "../../consts";
import { StringReader } from "../../string-reader";
import { CommandContext, CommandSyntaxException, NodeProperties, Parser } from "../../types";
import { ArrayReader } from "./nbt-util/array-reader";
import { NBTIssue } from "./nbt-util/nbt-issue";

const nbtPath = Path.resolve(__dirname, "../../node_modules/mc-nbt-paths/root.json");

const nbtRoot = JSON.parse(fs.readFileSync(Path.resolve(__dirname, nbtPath)).toString()) as NBTNode;

const endCompletableTag = /byte|short|int|long|float|double|string/;

const tryWithData = (func: () => any, data: any) => {
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
    context: CommandContext["commandInfo"]["nbtInfo"];
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

const valueParsers = {
    tagWholeNum: (reader: StringReader, suf?: string) => {
        const start = reader.cursor;
        try {
            reader.readScientific();
        } catch (e) {
            reader.cursor = start;
            reader.readInt();
        }
        if (suf !== undefined) {
            reader.expect(suf);
        }
        return reader.string.slice(start, reader.cursor);
    },
    tagFloatNum: (reader: StringReader, suf: string) => {
        const start = reader.cursor;
        try {
            reader.readScientific();
        } catch (e) {
            reader.cursor = start;
            reader.readFloat();
        }
        if (suf !== undefined) {
            reader.expect(suf);
        }
        return reader.string.slice(start, reader.cursor);
    },
    tagString: (reader: StringReader) => {
        const start = reader.cursor;
        reader.readString(true);
        return reader.string.slice(start, reader.cursor);
    },
    tagWholeNumArray: (reader: StringReader, suf: string) => {
        const start = reader.cursor;
        reader.expect(NBTLISTARROPEN);
        if (!reader.canRead()) {
            throw exception.invalidNbt.create(start, reader.cursor, "Expected " + NBTLISTARRCLOSE);
        }
        if (!(reader.peek() === suf && reader.peek(1) === NBTARRPREFIXSEP)) {
            throw exception.invalidArray.create(start, reader.cursor, reader.peek());
        }
        reader.skip(); reader.skip();
        let next: string = "";
        while (next !== NBTLISTARRCLOSE) {
            reader.skipWhitespace();
            valueParsers.tagWholeNum(reader, undefined);
            reader.skipWhitespace();
            next = reader.read();
        }
        return reader.string.slice(start, reader.cursor);
    },
    tagList: (reader: StringReader) => {
        const start = reader.cursor;
        reader.expect(NBTLISTARROPEN);
        if (!reader.canRead()) {
            throw new NBTIssue(exception.invalidNbt.create(start, reader.cursor, "Expected " + NBTLISTARRCLOSE), { correctType: true, completions: [NBTLISTARRCLOSE] });
        }
        reader.skipWhitespace();
        if (reader.peek() === NBTLISTARRCLOSE) {
            reader.skip();
            return NBTLISTARROPEN + NBTLISTARRCLOSE;
        }
        let listType;
        try {
            listType = parseValue(reader);
        } catch (err) {
            (err.data.path as string[]).splice(0, 0, ".");
            throw err;
        }
        reader.skipWhitespace();
        if (reader.peek() === NBTLISTARRCLOSE) {
            reader.skip();
            return reader.string.slice(start, reader.cursor);
        }
        tryWithData(() => reader.expect(NBTARGSEP), {
            correctType: true,
            compString: endCompletableTag.test(listType.type) ? listType.value.toString() : undefined,
        });
        while (reader.canRead()) {
            reader.skipWhitespace();
            const valStart = reader.cursor;
            let val;
            try {
                val = parseValue(reader);
            } catch (err) {
                (err.data.path as string[]).splice(0, 0, ".");
                throw err;
            }
            if (val.type !== listType.type) {
                throw new NBTIssue(exception.mixedList.create(valStart, reader.cursor, reader.string.charAt(valStart)), { correctType: true });
            }
            reader.skipWhitespace();
            if (reader.peek() === NBTLISTARRCLOSE) {
                break;
            }
            tryWithData(() => reader.expect(NBTARGSEP), {
                correctType: true,
                compString: endCompletableTag.test(val.type) ? val.value.toString() : undefined,
            });
        }
        reader.skip();
        return reader.string.slice(start, reader.cursor);
    },
    tagCompound: (reader: StringReader) => {
        const keys = [];
        const start = reader.cursor;
        reader.expect(NBTCOMPOUNDOPEN);
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
                throw err;
            }
            reader.skipWhitespace();
            next = reader.peek();
            if (next !== NBTCOMPOUNDCLOSE) {
                tryWithData(() => reader.expect(NBTARGSEP), {
                    compoundType: "val",
                    correctType: true,
                    pos: reader.cursor,
                    compString: /byte|short|int|long|float|double|string/.test(value.type) ? value.value : undefined,
                });
                reader.skipWhitespace();
            } else {
                reader.skip();
                return reader.string.slice(start, reader.cursor);
            }
        }
        reader.skip();
        return reader.string.slice(start, reader.cursor);
    },
};

const parserFunc = [
    {
        type: "byte",
        func: (reader: StringReader) => valueParsers.tagWholeNum(reader, NBTNUMBERSUFFIX.BYTE),
    },
    {
        type: "short",
        func: (reader: StringReader) => valueParsers.tagWholeNum(reader, NBTNUMBERSUFFIX.SHORT),
    },
    {
        type: "long",
        func: (reader: StringReader) => valueParsers.tagWholeNum(reader, NBTNUMBERSUFFIX.LONG),
    },
    {
        type: "float",
        func: (reader: StringReader) => valueParsers.tagFloatNum(reader, NBTNUMBERSUFFIX.FLOAT),
    },
    {
        type: "double",
        func: (reader: StringReader) => valueParsers.tagFloatNum(reader, NBTNUMBERSUFFIX.DOUBLE),
    },
    { // This is last because it is the least restrictive number
        type: "int",
        func: (reader: StringReader) => valueParsers.tagWholeNum(reader),
    },
    {
        type: "compound",
        func: (reader: StringReader) => valueParsers.tagCompound(reader),
    },
    {
        type: "byte_array",
        func: (reader: StringReader) => valueParsers.tagWholeNumArray(reader, NBTARRPREFIX.BYTE_ARR),
    },
    {
        type: "int_array",
        func: (reader: StringReader) => valueParsers.tagWholeNumArray(reader, NBTARRPREFIX.INT_ARR),
    },
    {
        type: "long_array",
        func: (reader: StringReader) => valueParsers.tagWholeNumArray(reader, NBTARRPREFIX.LONG_ARR),
    },
    {
        type: "list",
        func: (reader: StringReader) => valueParsers.tagList(reader),
    },
    { // most open. Will match pretty much anything
        type: "string",
        func: (reader: StringReader) => valueParsers.tagString(reader),
    },
];

interface ParserReturn {
    type: string;
    value: string;
}

export const parseValue = (reader: StringReader): ParserReturn => {
    let lastErr: NBTIssue;
    for (const e of parserFunc) {
        const start = reader.cursor;
        try {
            return { type: e.type, value: e.func(reader) };
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
            if (tagSuggestions[node.type] !== undefined) {
                out.comp = tagSuggestions[node.type](err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "", node, err);
            }
            out.startText = err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "";
            if (err.data.completions !== undefined) {
                out.comp.push(...err.data.completions);
            }
            out.startPos = err.data.pos === undefined ? 0 : err.data.pos;
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

const getNodeFromPath = (path: string[], context?: CommandContext) => {
    const type = context.commandInfo.nbtInfo.type;
    path.splice(0, 0, type, context.commandInfo.nbtInfo.id !== undefined ? context.commandInfo.nbtInfo.id : "none");
    const arrReader = new ArrayReader(path);
    return goToPathNode(nbtPath, nbtRoot, arrReader, context);
};

const goToPathNode = (currentPath: string, tempNode: NBTNode, arrReader: ArrayReader, context?: CommandContext): NBTNode => {
    const node = evalRef(currentPath, arrReader, tempNode, context);
    if (arrReader.done()) {
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
    const out = Object.assign(node) as NBTNode;
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
