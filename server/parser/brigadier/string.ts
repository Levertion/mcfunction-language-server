import { Argument, Properties, Arg } from "../arguments";
import { StringReader } from "../string-reader";

enum StringType {
    "word", "phrase", "greedy"
}
// See https://github.com/Microsoft/TypeScript/issues/14106#issuecomment-280253269
type StringTypeKey = keyof typeof StringType;
export interface StringProperties extends Properties {
    type: StringTypeKey;
}

export let StringArgument: Arg = {
    parse: (reader: StringReader, properties: StringProperties) => {
        const type = StringType[properties.type];
        switch (type) {
            case StringType.greedy:
                reader.cursor = reader.string.length;
                break;
            case StringType.word:
                reader.readUnquotedString();
                break;
            default:
                reader.readString();
                break;
        }
    },
    listSuggestions: () => {
        return [] as string[];
    },
};
