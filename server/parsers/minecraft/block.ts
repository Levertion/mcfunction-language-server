import { readFileSync } from "fs";
import { CompletionItemKind } from "vscode-languageserver/lib/main";
import { DEFAULTNAMESPACE, MAXSUGGESTIONS, NAMESPACESEPERATOR, NBTCOMPOUNDOPEN, PROPCLOSER, PROPDEFINER, PROPSEPERATOR, PROPSOPENER, TAGSTART } from "../../consts";
import { StringReader } from "../../string-reader";
import { CommandContext, CommandSyntaxException, NodeProperties, Parser, Suggestion as Suggestion1, SuggestResult } from "../../types";
import { parser as NBTParser } from "./nbt";

const EXCEPTIONS = {
    tag_disallowed: new CommandSyntaxException("Tags aren't allowed here, only actual blocks", "argument.block.tag.disallowed"),
    id_invalid: new CommandSyntaxException("Unknown block type '%s'", "argument.block.id.invalid"),
    unknown_property: new CommandSyntaxException("Block %s does not have property '%s'", "argument.block.property.unknown"),
    duplicate_property: new CommandSyntaxException("Property '%s' can only be set once for block '%s'", "argument.block.property.duplicate"),
    invalid_value: new CommandSyntaxException("Block %s does not accept '%s' for %s property", "argument.block.property.invalid"),
    novalue_property: new CommandSyntaxException("Expected value for property '%s' on block %s", "argument.block.property.novalue"),
    unclosed_property: new CommandSyntaxException("Expected closing ] for block state properties", "argument.block.property.unclosed"),
};

interface BlockStateInfo {
    [id: string]: {
        states: { [stateName: string]: string[] };
    };
}
const DEFAULTBLOCKSPATH = "../../../information/blockstates.json";
let blocks: BlockStateInfo;
let blocksPath: string;
interface Suggestion {
    startText: string;
    startPos: number;
    valid?: boolean;
}
interface NameSuggester extends Suggestion {
    type: "name";
}
interface ValueSuggester extends Suggestion {
    type: "value";
    options: string[];
}
interface PropertySuggester extends Suggestion {
    type: "property";
    block: string;
}
interface NBTSuggester extends Suggestion {
    type: "nbt";
    values: string[];
}
type Suggester = NameSuggester | ValueSuggester | PropertySuggester | NBTSuggester;
function blockParser(reader: StringReader, suggesting: boolean, context: CommandContext): Suggester | void {
    const begin = reader.cursor;
    if (reader.canRead() && reader.peek() === TAGSTART) {
        // Do Tag Stuff
    } else {
        const block = reader.readUntilRegexp(/[\[{ ]/);
        let blockId;
        const namespaceSepLocation = block.indexOf(NAMESPACESEPERATOR);
        if (namespaceSepLocation === -1) {
            blockId = DEFAULTNAMESPACE + NAMESPACESEPERATOR + block;
        } else {
            blockId = block;
        }
        if (!blocksPath) {
            blocksPath = DEFAULTBLOCKSPATH;
            blocks = JSON.parse(readFileSync(require.resolve(blocksPath)).toString());
        }
        const validBlock = blocks.hasOwnProperty(blockId);
        if (suggesting && !reader.canRead()) {
            return { type: "name", valid: validBlock, startText: blockId, startPos: 0 };
        }
        if (validBlock) {
            if (reader.peek() === PROPSOPENER) {
                reader.skip();
                const blockInfo = blocks[blockId];
                const curProps: string[] = [];
                let looping = true;
                if (reader.peek() === PROPCLOSER) {
                    reader.skip();
                    looping = false;
                }
                while (looping) {
                    const propStart = reader.cursor;
                    const prop = reader.readString();
                    const propValid = blockInfo.states.hasOwnProperty(prop);
                    if (suggesting && !reader.canRead()) {
                        return { type: "property", block: blockId, valid: propValid, startPos: propStart, startText: prop };
                    }
                    if (propValid) {
                        if (curProps.includes(prop)) {
                            throw EXCEPTIONS.duplicate_property.create(propStart, reader.cursor, prop, blockId);
                        }
                        if (reader.peek() === PROPDEFINER) {
                            reader.skip();
                            const valStart = reader.cursor;
                            const val = reader.readString();
                            const valValid = blockInfo.states[prop].includes(val);
                            if (suggesting && !reader.canRead()) {
                                return { type: "value", options: blockInfo.states[prop], valid: valValid, startPos: valStart, startText: val };
                            }
                            if (valValid) {
                                switch (reader.peek()) {
                                    case PROPSEPERATOR:
                                        reader.skip();
                                        continue;
                                    case PROPCLOSER:
                                        looping = false;
                                        reader.skip();
                                        // Collapse down the if-else trees until we reach NBT checking.
                                        break;
                                    default:
                                        throw EXCEPTIONS.unclosed_property.create(propStart, reader.cursor);
                                }
                            } else {
                                if (val.length === 0) {
                                    throw EXCEPTIONS.novalue_property.create(propStart, reader.cursor, prop, blockId);
                                }
                                throw EXCEPTIONS.invalid_value.create(valStart, reader.cursor, blockId, val, prop);
                            }
                        } else {
                            throw EXCEPTIONS.novalue_property.create(propStart, reader.cursor, prop, blockId);
                        }
                    } else {
                        throw EXCEPTIONS.unknown_property.create(propStart, reader.cursor, blockId, prop);
                    }
                }
            }
        } else {
            throw EXCEPTIONS.id_invalid.create(begin, reader.cursor, blockId);
        }
        if (reader.peek() === NBTCOMPOUNDOPEN) {
            if (suggesting) {
                const nbtStart = reader.cursor;
                const nbtSuggestions = NBTParser.getSuggestions(reader.string.slice(nbtStart), undefined, {
                    datapacksFolder: null,
                    executionTypes: null,
                    executortype: null,
                    commandInfo: {
                        nbtInfo: {
                            type: "block",
                            id: blockId,
                        },
                    },
                });
                const firstSuggest: SuggestResult = nbtSuggestions.length === 0 ? { start: 0, value: "" } : nbtSuggestions[0];
                const vPos = nbtStart + (isSuggestion(firstSuggest) ? firstSuggest.start : 0);
                const out: NBTSuggester = {
                    startText: reader.string.slice(vPos),
                    startPos: vPos,
                    values: nbtSuggestions.map((v) => isSuggestion(v) ? v.value : v),
                    valid: true,
                    type: "nbt",
                };
                return out;
            } else {
                NBTParser.parse(reader, undefined, context);
                return;
            }
        }
    }
}

const isSuggestion = (o: any): o is Suggestion1 => {
    return "kind" in o;
};

export const parser: Parser = {
    parse: (reader: StringReader, _prop: NodeProperties, context: CommandContext) => {
        blockParser(reader, false, context);
    },
    getSuggestions: (start: string, _prop: NodeProperties, context: CommandContext) => {
        const suggestions: SuggestResult[] = [];
        try {
            const reader = new StringReader(start);
            const suggestionInfo = blockParser(reader, true, context);
            if (!!suggestionInfo) {
                switch (suggestionInfo.type) {
                    case "name":
                        if (suggestionInfo.valid) {
                            suggestions.push({ start: reader.cursor, value: PROPSOPENER, kind: CompletionItemKind.Method });
                        }
                        for (const blockID in blocks) {
                            if (blocks.hasOwnProperty(blockID) && blockID.startsWith(suggestionInfo.startText) && suggestions.length < MAXSUGGESTIONS) {
                                suggestions.push(blockID);
                            }
                        }
                        break;
                    case "property":
                        if (suggestionInfo.valid) {
                            suggestions.push({ start: reader.cursor, value: PROPDEFINER, kind: CompletionItemKind.Method });
                        }
                        for (const propName in blocks[suggestionInfo.block].states) {
                            if (blocks[suggestionInfo.block].states.hasOwnProperty(propName) && propName.startsWith(suggestionInfo.startText)) {
                                suggestions.push({ start: suggestionInfo.startPos, value: propName, kind: CompletionItemKind.Property });
                            }
                        }
                        break;
                    case "value":
                        if (suggestionInfo.valid) {
                            suggestions.push({ start: reader.cursor, value: PROPSEPERATOR, kind: CompletionItemKind.Enum }, { start: reader.cursor, value: PROPCLOSER, kind: CompletionItemKind.Field });
                        }
                        for (const option of suggestionInfo.options) {
                            if (option.startsWith(suggestionInfo.startText)) {
                                suggestions.push({ value: option, start: suggestionInfo.startPos, kind: CompletionItemKind.Value });
                            }
                        }
                        break;
                    case "nbt":
                        for (const val of suggestionInfo.values) {
                            suggestions.push({ start: suggestionInfo.startPos, value: val });
                        }
                        break;
                    default:
                        break;
                }
            }
        } catch (_) {
            // do nothing
        }
        return suggestions;
    },
    kind: CompletionItemKind.Interface,
};
