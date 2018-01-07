import { CommandIssue, SuggestResult } from "../../../types";

export class NBTIssue {
    public data: NBTIssueData;
    public err: CommandIssue;
    constructor(err: CommandIssue, data: NBTIssueData = {}) {
        this.err = err;
        const copyDefaultData = JSON.parse(JSON.stringify(defaultData));
        this.data = Object.assign(copyDefaultData, data);
    }
}

const defaultData: NBTIssueData = {
    path: [],
    correctType: false,
    currKeys: [],
    compoundType: undefined,
    pos: 0,
    compString: "",
    completions: [],
    parsedValue: {},
};

export interface NBTIssueData {
    path?: string[];
    parsedValue?: any;
    correctType?: boolean;
    compoundType?: string;
    currKeys?: string[];
    pos?: number;
    compString?: string;
    completions?: SuggestResult[];
}
