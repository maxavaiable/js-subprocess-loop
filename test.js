import {test, mock, describe} from "node:test";
import assert, {rejects} from "node:assert";
import {SubprocessLoop} from "./index.js";

describe("SubprocessLoop", () => {
    test("python launch", async (t) => {
        let sumByPy = new SubprocessLoop("sumByPy", "python", "./samples/subprocess.py");
        sumByPy.launch();
        let result = await sumByPy.getResponse(100, 100);
        sumByPy.terminate();
        console.log(result);
        assert.equal(result.data, 101);
    });
});