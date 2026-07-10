# Python: AnalyticsController_trackEvent_v1

```python
import requests

url = "https://api.1browser.com/v1/analytics"
headers = {
  "Content-Type": "application/json"
}
payload = {
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```
