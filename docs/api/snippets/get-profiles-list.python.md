# Python: Get profiles list

```python
import requests

url = "https://api.1browser.com/v1/profiles?page=1"
headers = {
  "Authorization": "Bearer <token>"
}

response = requests.get(url, headers=headers)
print(response.json())
```
