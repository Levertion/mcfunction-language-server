import { CommandIssue } from "../../../types";

export class NBTIssue {
    public data: any;
    public err: CommandIssue;
    constructor(err: CommandIssue, data: any) {
        this.err = err;
        this.data = data;
    }
}
