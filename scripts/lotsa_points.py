import json
import random

data = [{'u': random.random(), 'v': random.random()} for i in range(100000)]

print json.dumps(data)

