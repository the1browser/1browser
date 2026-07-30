# Go: Delete profiles

```go
package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	body := []byte("{\"profileIds\":[\"64a1f2e3b4c5d6e7f8a9b0c1\"]}")
	req, err := http.NewRequest("DELETE", "https://api.1browser.com/v1/profiles", bytes.NewBuffer(body))
	if err != nil {
		panic(err)
	}
	req.Header.Set("Authorization", "Bearer <token>")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	fmt.Println(string(data))
}
```
