import subprocess_loop
import sys

def on_request(request):
    print ("in loop")
    return request+1

print ("before loop")
subprocess_loop.Child.run(on_request)
print ("after loop")
