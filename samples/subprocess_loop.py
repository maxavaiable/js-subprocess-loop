import json
import sys
import io

class _StringIO:
    
    def __init__(self):
        self._io = io.StringIO()
        self._is_not_empty=False

    def write(self, data):
        if (data!="\n"):
            self._io.write(data)
            self._is_not_empty=True
            self.flush()

    def flush(self):
        if (self._is_not_empty):
            value = self._io.getvalue()
            self._io.truncate(0)
            self._io.seek(0)
            self._is_not_empty=False
            self._on_write(value)

    def on_write(self, callback):
        self._on_write = callback

class SubprocessLoopChild:

    _stdout = _StringIO()
    _stdin = io.StringIO()
    _orig_stdout = sys.stdout
    _orig_stdin = sys.stdin
    sys.stdout = _stdout
    sys.stdin = _stdin

    @staticmethod
    def run(on_request):

        SubprocessLoopChild._stdout.on_write(SubprocessLoopChild._on_default_write)

        while(True):
            request_json = SubprocessLoopChild._orig_stdin.readline()
            if (len(request_json)==0):
                break
            request = json.loads(request_json)
            response_data = on_request(request["data"])
            response = {"id": request["id"], "data": response_data}
            SubprocessLoopChild._orig_stdout.write(json.dumps(response))
            SubprocessLoopChild._orig_stdout.flush()
        pass

    @staticmethod
    def _on_default_write(data):
        response = {"stdout": data}
        SubprocessLoopChild._orig_stdout.write(json.dumps(response))
        SubprocessLoopChild._orig_stdout.flush()

