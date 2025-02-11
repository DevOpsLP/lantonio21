# BingXClient

This TypeScript library provides a lightweight wrapper around the BingX API using Axios. It handles both public and private API calls, automatically signs requests when needed, and takes care of parsing responses with large integers and fixing objects with a null prototype.

---

## Features

- **Public & Private API Calls:**  
  Easily make GET, POST, PUT, and DELETE requests. Private endpoints are signed automatically using your API key and secret.

- **BigInt Support:**  
  Uses `JSONBig` to correctly parse responses that include very large integers.

- **Null Prototype Fix:**  
  Converts objects with a null prototype into normal plain objects to avoid `[Object: null prototype]` issues.

---
## Installation

Make sure you have the required dependencies:

```bash
npm install axios crypto qs json-bigint
```
If you’re using TypeScript, you may also want to install type definitions for these packages if they aren’t bundled.

---

# Usage

### Initializing the Client

Import the BingXClient and create a new instance. For private API calls, pass in your API key and secret:
```typescript
import { BingXClient } from './BingXClient';

const client = new BingXClient({
  apiKey: 'your_api_key_here',       // Required for private requests
  apiSecret: 'your_api_secret_here', // Required for private requests
  baseURL: 'https://open-api.bingx.com', // Optional (default provided)
  timeout: 5000                      // Optional (default is 5000ms)
});
```
---

### Making API Calls

#### Public API Call

For endpoints that don’t require authentication, set isPrivate to false (or simply use get for public GET calls):

```typescript
client.get('/public-endpoint', { param1: 'value1' }, false)
  .then(response => {
    console.log('Public API Response:', response);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```
---

#### Private API Call

For endpoints requiring authentication, use the provided methods (the default for these is isPrivate = true):

```typescript
client.post('/private-endpoint', { key: 'value' })
  .then(response => {
    console.log('Private API Response:', response);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

#### PUT and DELETE Calls

You can also make PUT and DELETE calls in a similar fashion:

##### PUT example:
```typescript

client.put('/update-endpoint', { updateKey: 'newValue' })
  .then(response => {
    console.log('Update Response:', response);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

##### DELETE example:
```typescript
client.delete('/delete-endpoint', { id: 12345 })
  .then(response => {
    console.log('Delete Response:', response);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

---

### How It Works

- Response Transformation:
When a response comes back, Axios first uses JSONBig to parse the response (to correctly handle large numbers) and then runs a function to convert any objects with a null prototype into standard objects.
- Request Signing: For private requests, a timestamp is added and a signature is generated using HMAC-SHA256 over a sorted query string of your parameters. This signature is automatically appended to your request.
- Error Handling:
If an error occurs during the API call, the client formats a detailed error message with the status, error code, and request details.