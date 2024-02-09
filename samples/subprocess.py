import subprocess_loop

def on_request(request):
    return request+1

subprocess_loop.Child.run(on_request)