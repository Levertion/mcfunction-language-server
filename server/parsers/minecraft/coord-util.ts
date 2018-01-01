import { StringReader } from "../../string-reader";

export interface Coord {
    type: "absolute" | "relative" | "local";
    value: number;
}

export interface AxisCoord {
    axis: "x" | "y" | "z";
    coord: Coord;
}

const _coordLimit = {
    minX: -30000000,
    maxX: 30000000,
    minY: 0,
    maxY: 256,
    minZ: -30000000,
    maxZ: 30000000,
};

export class CoordUtil {
    public static coordLimit: { [key: string]: { min: number, max: number } } = {
        x: {
            min: _coordLimit.minX,
            max: _coordLimit.maxX,
        },
        y: {
            min: _coordLimit.minY,
            max: _coordLimit.maxY,
        },
        z: {
            min: _coordLimit.minZ,
            max: _coordLimit.maxZ,
        },
    };
    public static readCoord(reader: StringReader): Coord {
        const out: Coord = { type: null, value: null };
        if (reader.peek() === "~") {
            out.type = "relative";
            reader.skip();
        } else if (reader.peek() === "^") {
            out.type = "local";
            reader.skip();
        } else {
            out.type = "absolute";
        }
        if (out.type !== "absolute" && (reader.peek() === " " || !reader.canRead())) {
            out.value = 0;
        } else {
            out.value = reader.readFloat();
        }
        return out;
    }
    public static allWorldOrLocal(coords: AxisCoord[]): boolean {
        return coords.every((e, _i, a) => {
            return e.coord.type === a[0].coord.type;
        });
    }
    public static outOfWorld(coords: AxisCoord[]): boolean {
        return coords.some((v) => (v.coord.value < this.coordLimit[v.axis].min) || (v.coord.value > this.coordLimit[v.axis].max));
    }
}
