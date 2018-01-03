import fs = require("fs");
import Path = require("path");
import Url = require("url");
import { NBTARGSEP, NBTARRPREFIX, NBTARRPREFIXSEP, NBTCOMPOUNDCLOSE, NBTCOMPOUNDOPEN, NBTKEYVALUESEP, NBTLISTARRCLOSE, NBTLISTARROPEN, NBTNUMBERSUFFIX } from "../../consts";
import { StringReader } from "../../string-reader";
import { CommandContext, CommandIssue, CommandSyntaxException, NodeProperties, Parser } from "../../types";

const nbtPath = Path.resolve(__dirname, "../../node_modules/mc-nbt-paths/root.json");

const nbtRoot = JSON.parse(fs.readFileSync(Path.resolve(__dirname, nbtPath)).toString()) as NBTNode;

const endCompletableTag = /byte|short|int|long|float|double|string/;

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

class ArrayReader {

    private arr: string[];
    private index = 0;

    public constructor(arr: string[]) {
        this.arr = arr;
    }

    public next() {
        return this.arr[this.index++];
    }

    public peek() {
        return this.arr[this.index];
    }

    public skip() {
        this.index++;
    }

    public done() {
        return this.arr.length === this.index;
    }

    public addAtCursor(items: string[]) {
        this.arr.splice(this.index, 0, ...items);
    }
}

const exception = {
    trailingData: new CommandSyntaxException("Unexpected trailing data", "argument.nbt.trailing"),
    needKey: new CommandSyntaxException("Extected key", "argument.nbt.expected.key"),
    needValue: new CommandSyntaxException("Extected value", "argument.nbt.expected.value"),
    mixedList: new CommandSyntaxException("Can't insert %s into list of %s", "argument.nbt.list.mixed"),
    mixedArray: new CommandSyntaxException("Can't insert %s into %s", "argument.nbt.array.mixed", 1, { correctType: true }),
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
            throw exception.invalidNbt.create(start, reader.cursor, { correctType: true, completions: [NBTLISTARRCLOSE] }, "Expected " + NBTLISTARRCLOSE);
        }
        reader.skipWhitespace();
        if (reader.peek() === NBTLISTARRCLOSE) {
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
            return reader.string.slice(start, reader.cursor);
        }
        reader.expect(NBTARGSEP, {
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
                throw exception.mixedList.createWithData(valStart, reader.cursor, { correctType: true }, reader.string.charAt(valStart));
            }
            reader.skipWhitespace();
            if (reader.peek() === NBTLISTARRCLOSE) {
                break;
            }
            reader.expect(NBTARGSEP, {
                correctType: true,
                compString: endCompletableTag.test(val.type) ? val.value.toString() : undefined,
            });
        }
        return reader.string.slice(start, reader.cursor);
    },
    tagCompound: (reader: StringReader) => {
        const out: any = {};
        const start = reader.cursor;
        reader.expect(NBTCOMPOUNDOPEN);
        if (!reader.canRead()) {
            throw exception.invalidNbt.createWithData(start, reader.cursor, { correctType: true, completions: [NBTCOMPOUNDCLOSE] }, "Expected }");
        }
        let next = reader.peek();
        while (next !== NBTCOMPOUNDCLOSE) {
            reader.skipWhitespace();
            let key;
            try {
                key = reader.readString();
            } catch (err) {
                throw exception.needKey.createWithData(start, reader.cursor, { correctType: true });
            }
            reader.skipWhitespace();
            reader.expect(NBTKEYVALUESEP, { correctType: true, compString: key });
            reader.skipWhitespace();
            if (!reader.canRead()) {
                throw exception.needValue.createWithData(reader.cursor, reader.cursor, { compString: "", correctType: true, path: [key] });
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
                reader.expect(NBTARGSEP, {
                    correctType: true,
                    compString: /byte|short|int|long|float|double|string/.test(value.type) ? value.value : undefined,
                });
                reader.skipWhitespace();
            } else {
                reader.skip();
            }
            out[key] = value;
        }
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
    let lastErr: CommandIssue;
    for (const e of parserFunc) {
        const start = reader.cursor;
        try {
            return { type: e.type, value: e.func(reader) };
        } catch (err) {
            reader.cursor = start;
            if ((lastErr === undefined || lastErr.data === undefined || lastErr.data.correctType === undefined || (lastErr.data.correctType && err.data.correctType) || !lastErr.data.correctType)) {
                lastErr = err;
            }
        }
    }
    throw lastErr;
};

export const parser: Parser = {
    parse: (reader: StringReader, _prop: NodeProperties, _context?: CommandContext) => {
        return valueParsers.tagCompound(reader);
    },

    getSuggestions: (text: string, _prop: NodeProperties, context?: CommandContext) => {
        if (context === undefined) {
            return [""];
        }
        let out: string[] = [];
        const reader = new StringReader(text);
        try {
            parseValue(reader);
        } catch (err) {
            if (err.data !== undefined) {
                const path: any = err.data.path;
                const node = getNodeFromPath(path, context);
                out = tagSuggestions[node.type](err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "");
                out.push(...err.data.completions);
            }
        }
        return out;
    },
};

export const getSuggestionsWithStartText = (text: string, _prop: NodeProperties, context?: CommandContext) => {
    const out: { startText?: string, comp?: string[] } = {};
    const reader = new StringReader(text);
    try {
        parseValue(reader);
    } catch (err) {
        if (err.data !== undefined) {
            const path: any = err.data.path;
            const node = getNodeFromPath(path, context);
            out.comp = tagSuggestions[node.type](err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "");
            out.startText = err.data !== undefined && err.data.compString !== undefined ? err.data.compString : "";
        }
    }
    return out;
};

const tagSuggestions: { [index: string]: (text: string) => string[] } = {
    byte: (text: string) => ["-256b", "0b", "1b", "255b"].filter((val) => val.startsWith(text)),
    short: (text: string) => ["-32768s", "0s", "1s", "32767s"].filter((val) => val.startsWith(text)),
    int: (text: string) => ["-2147483648", "0", "1", "2147483647"].filter((val) => val.startsWith(text)),
    long: (text: string) => ["0l", "1l"].filter((val) => val.startsWith(text)),
    float: (text: string) => ["0f", "1f"].filter((val) => val.startsWith(text)),
    double: (text: string) => ["0d", "1d"].filter((val) => val.startsWith(text)),
};

const getNodeFromPath = (path: string[], context?: CommandContext) => {
    const type = context.commandInfo.nbtInfo.type;
    path.splice(0, 0, type, context.commandInfo.nbtInfo.id !== undefined ? context.commandInfo.nbtInfo.id : "none");
    return goToPathNode(nbtPath, nbtRoot, new ArrayReader(path), context);
};

const goToPathNode = (currentPath: string, node: NBTNode, arrReader: ArrayReader, context?: CommandContext): NBTNode => {
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
        if (node.child_ref !== undefined) {
            const evalNode = evalNodeWithChildRefs(currentPath, node, context);
            const out = goToPathNode(currentPath, evalNode.children[next], arrReader, context);
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
    } else if (node.ref !== undefined) {
        const refUrl = Url.parse(node.ref);
        const fragParts = refUrl.hash === null ? [] : refUrl.hash.slice(1).split("/");
        arrReader.addAtCursor(fragParts);
        const refPath = Path.resolve(Path.parse(currentPath).dir, refUrl.path);
        return goToPathNode(refPath, JSON.parse(fs.readFileSync(refPath).toString()), arrReader, context);
    }
    return null;
};

const evalNodeWithChildRefs = (currentPath: string, node: NBTNode, context?: CommandContext) => {
    const out = Object.assign(node) as NBTNode;
    for (const cr of node.child_ref) {
        const refUrl = Url.parse(cr);
        const fragParts = refUrl.hash.slice(1).split("/");
        const crArrReader = new ArrayReader(fragParts);
        const refPath = Path.resolve(currentPath, refUrl.path);
        const refNode = goToPathNode(refPath, JSON.parse(fs.readFileSync(refPath).toString()), crArrReader, context);
        if (refNode.child_ref !== undefined) {
            const evalNode = evalNodeWithChildRefs(refPath, refNode, context);
            for (const c of Object.keys(evalNode.children)) {
                out.children[c] = evalNode.children[c];
            }
        }
    }
    return out;
};
