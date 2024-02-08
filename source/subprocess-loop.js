import * as ChildProcess from "node:child_process";
import * as os from "node:os";
import {performance} from "node:perf_hooks";
import {EventEmitter} from "node:events";

class SubprocessLoop extends EventEmitter {
    static ERROR_TIMEOUT = "timeOut";
    static ERROR_LOST_RUN = "lostOfRun";

    static #stateIndex = 0;
    static #STATE_CREATE = SubprocessLoop.#stateIndex++;
    static #STATE_ERROR = SubprocessLoop.#stateIndex++;
    static #STATE_RUNNING = SubprocessLoop.#stateIndex++;
    static #STATE_WAIT_CLOSE = SubprocessLoop.#stateIndex++;
    static #STATE_RELEASE = SubprocessLoop.#stateIndex++;
    #state = SubprocessLoop.#STATE_CREATE;

    /**@type {boolean} */
    get isRunning() {
        return this.#state == SubprocessLoop.#STATE_RUNNING;
    }

    #alias;
    #command;
    #args;
    /**@type {ChildProcess.ChildProcessWithoutNullStreams} */
    #process;
    /**@type {{number:{request:object, time:Date, onResponse:function, timeOut:number}}}*/
    #requestsInfo = {};
    /**@type {NodeJS.Timeout} */
    #checkResponses;
    /**@type {number} */
    #requestLastId = 0;

    #consoleLogShow = true;
    get consoleLogShow() {
        return this.#consoleLogShow;
    }
    set consoleLogShow(value) {
        if (value === true || value === false) {
            this.#consoleLogShow = value;
        }
    }

    #consoleErrorShow = true;
    get consoleErrorShow() {
        return this.#consoleLogShow;
    }
    set consoleErrorShow(value) {
        if (value === true || value === false) {
            this.#consoleErrorShow = value;
        }
    }

    /**
     * Initialize subprocess with loop of stdio exchange.
     * launch(); for run subprocess.
     * @param {string} processAlias alias of process for mark on console/debug
     * @param {string} command general command
     * @param  {...any} args all args
     */
    constructor(processAlias, command, ...args) {
        super();

        this.#alias = processAlias;
        this.#command = command;
        this.#args = args;
    }

    /**
     * Run subprocess
     */
    launch() {
        this.#process = ChildProcess.spawn(this.#command, this.#args);

        this.#process.on("error", this.#onError.bind(this));
        this.#process.stdout.on("data", this.#onStdoutData.bind(this));
        this.#process.stdout.on("end", this.#onStdoutEnd.bind(this));
        this.#process.stderr.on("data", this.#onStderrData.bind(this));
        this.#process.on("spawn", this.#onSpawn.bind(this));

        this.#checkResponses = setInterval(this.#onCheckResponse.bind(this), 100);
    }

    #onSpawn() {
        this.#state = SubprocessLoop.#STATE_RUNNING;
        this.emit("running");
    }

    #onError(error) {
        this.#state = SubprocessLoop.#STATE_ERROR;
        this.emit("error", error);
    }

    #onStderrData(data) {
        if (this.#consoleErrorShow) {
            console.error(this.#alias + ": " + data);
        }
        this.emit("stderr", data);
    }

    #onStdoutData(data) {
        let json = data.toString();
        let errors = null;
        let response = null;

        //try single json
        try {
            response = JSON.parse(json);
        } catch (e) {
            errors += e.toString();
        }
        if (response) {
            this.#onResponse(response);
        } else {
            //try split json
            try {
                json = json.replaceAll("}{", "},{");
                json = "[" + json + "]";
                response = JSON.parse(json);
            } catch (e) {
                errors += e.toString();
            }
            if (response) {
                response.forEach((r) => this.#onResponse(r));
            }
        }
    }

    #onResponse(response) {
        let id = response.id;
        if (id !== undefined) {
            let info = this.#requestsInfo[id];
            if (info !== undefined) {
                info.onResponse(response);
            }
        } else if (response.stdout !== undefined) {
            if (this.#consoleLogShow) {
                console.log(this.#alias + ": " + response.stdout);
            }
            this.emit("stdout", response.stdout);
        }
    }

    #onStdoutEnd() {
        this.#state = SubprocessLoop.#STATE_RELEASE;
        this.emit("terminated");
    }

    #onCheckResponse() {
        Object.entries(this.#requestsInfo).forEach(({0: id, 1: info}) => {
            let time = performance.now() - info.time;
            if (time > info.timeOut) {
                info.onResponse({error: SubprocessLoop.ERROR_TIMEOUT, id: info.id});
            }
        });
    }

    /**
     * get response of sended request
     * @param {object} data user data
     * @param {number} timeOut time out of stdio response
     * @returns {Promise}
     */
    async getResponse(data, timeOut = 100) {
        return await new Promise((resolve, reject) => {
            let request = {
                id: this.#requestLastId++,
                data: data,
            };
            this.#requestsInfo[request.id] = {
                request: request,
                timeOut: timeOut,
                time: performance.now(),
                onResponse: (response) => {
                    resolve(response);
                    delete this.#requestsInfo[request.id];
                },
            };
            let jsonBuffer = Buffer.from(JSON.stringify(request));
            this.#process.stdin.setEncoding("utf-8");
            this.#process.stdin.write(jsonBuffer);
            this.#process.stdin.write(os.EOL);
        });
    }

    /**
     * terminate subprocess normally or kill after timeout
     * @param {number} killingTimeOut timeout to terminate a process if it is not closed in time
     */
    terminate(killingTimeOut = 1000) {
        Object.entries(this.#requestsInfo).forEach(({0: id, 1: info}) => {
            info.onResponse({error: SubprocessLoop.ERROR_LOST_RUN, id: id});
        });
        clearInterval(this.#checkResponses);
        this.#process.stdin.end();
        this.#state = SubprocessLoop.#STATE_WAIT_CLOSE;

        setTimeout(() => {
            if (this.#state == SubprocessLoop.#STATE_WAIT_CLOSE) {
                this.#process.kill();
            }
        }, killingTimeOut);
    }
}

export {SubprocessLoop};
