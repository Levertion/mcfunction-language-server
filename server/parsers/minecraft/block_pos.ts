import { CommandSyntaxException, Parser } from "../../types";
import { AxisCoord, CoordUtil } from "./coord-util";

const typeMatch = {
    absolute: 1,
    relative: 1,
    local: 2,
};

const exceptions = {
    invalidMatch: new CommandSyntaxException("Cannot mix world & local coordinates (everything must use '^' or not)", "argument.block_pos.mixedCoords"),
    coordFloat: new CommandSyntaxException("Block positions cannot be floating point", "argument.block_pos.float"),
    outOfWorld: new CommandSyntaxException("Block position is outside of the world", "argument.block_pos.outofworld"),
};

export const parser: Parser = {
    parse: (reader) => {
        const start = reader.cursor;
        const xPos = CoordUtil.readCoord(reader);
        reader.skip();
        const yPos = CoordUtil.readCoord(reader);
        reader.skip();
        const zPos = CoordUtil.readCoord(reader);
        const coords: AxisCoord[] = [{ coord: xPos, axis: "x" }, { coord: yPos, axis: "y" }, { coord: zPos, axis: "z" }];

        coords.forEach((e) => {
            if (!Number.isInteger(e.coord.value) && e.coord.type === "absolute") {
                throw exceptions.coordFloat.create(start, reader.cursor);
            }
        });

        if (!CoordUtil.allWorldOrLocal(coords)) {
            throw exceptions.invalidMatch.create(start, reader.cursor);
        }
        if (typeMatch[xPos.type] === 1) {
            if (CoordUtil.outOfWorld(coords)) {
                throw exceptions.outOfWorld.create(start, reader.cursor);
            }
        }
    },

    getSuggestions: (text) => {
        return [text];
    },
};
