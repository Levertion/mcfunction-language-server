export class ArrayReader {

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
