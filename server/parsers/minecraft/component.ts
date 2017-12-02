import * as ajv from "ajv";
import { readFileSync } from "fs";
import * as path from "path";
import { StringReader } from "../../string-reader";
import { CommandSyntaxException, Parser } from "../../types";
const COMPONENTEXCEPTIONS = {
    INVALIDJSON: new CommandSyntaxException("`%s` is invalid Json", "argument.component.invalidjson"),
    INVALIDCOMPONENT: new CommandSyntaxException("Invalid component: %s", "argument.component.invalidcomponent"),
};

export const componentArgumentParser: Parser = {
    parse: (reader: StringReader) => {
        const begin = reader.cursor;
        reader.cursor = reader.string.length - 1;
        const read = reader.getRemaining();
        let component;
        try {
            component = JSON.parse(read);
        } catch (error) {
            throw COMPONENTEXCEPTIONS.INVALIDJSON.create(begin, reader.cursor, read);
        }
        let schema;
        const schemaPath = path.join(__dirname, "mcdefinitions.json");
        try {
            schema = JSON.parse(readFileSync(schemaPath, "utf8"));
        } catch (error) {
            throw new CommandSyntaxException("Could not find JSON schema", "arguments.component.json").create(begin, reader.cursor);
        }
        const validator = new ajv({ async: false });
        const validate = validator.addSchema(schema, "mcdefinitions").compile({ $ref: "mcdefinitions#/definitions/text_component" });
        validate(component);
        if (validator.errors.length > 0) {
            throw COMPONENTEXCEPTIONS.INVALIDCOMPONENT.create(begin, reader.cursor, validator.errorsText(validator.errors));
        }
    },
    getSuggestions: () => {
        // In JSON suggestions are tough. I might try to create a Pseudo editor and use the pre-made vscode json schema implementation
        return [];
    },
};
