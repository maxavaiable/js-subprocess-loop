import json
import time
from subprocess_loop import SubprocessLoopChild

def on_request(request):
    return request+1

SubprocessLoopChild.run(on_request)