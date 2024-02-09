# [subprocess-loop](https://www.npmjs.com/package/subprocess-loop)

<!-- change above url according to repo -->

This Node.js project facilitates communication with subprocesses, particularly programs written in Python or other languages, using standard input and output (stdio) in JSON format.

## Installation

```bash
npm i subprocess-loop
pip install subprocess-loop
```

### Running subprocess code:

```java script
import {SubprocessLoop} from "subprocess-loop";

let sumByPy = new SubprocessLoop("sumByPy", "python", "-u", "./child.py");
sumByPy.launch();
let result = await sumByPy.getResponse(100, 100);
sumByPy.terminate();
console.log(result);

```

```python
# child.py
import subprocess_loop

def on_request(request):
    return request+1

subprocess_loop.Child.run(on_request)
```
